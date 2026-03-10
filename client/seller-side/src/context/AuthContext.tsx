import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

interface SellerProfile {
    status?: string;
}

interface User {
    id: number;
    username?: string;
    email: string;
    role: string;
    is_superuser?: boolean;
    seller_profile?: SellerProfile | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (tokens: { access: string; refresh?: string }) => Promise<User | null>;
    logout: () => void;
    isAdmin: boolean;
    isSeller: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchProfileWithRetry = async (retries = 2): Promise<User> => {
        let lastError: any = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await api.get('/users/profile/');
                return response.data;
            } catch (error: any) {
                lastError = error;
                const status = error?.response?.status;
                const shouldRetry = status === 429 && attempt < retries;
                if (shouldRetry) {
                    await wait(400 * (attempt + 1));
                    continue;
                }
                throw error;
            }
        }

        throw lastError;
    };

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token') || localStorage.getItem('access_token');
            if (token) {
                try {
                    const profile = await fetchProfileWithRetry();
                    setUser(profile);
                } catch (error: any) {
                    console.error("Failed to fetch profile during auth init:", error);
                    const status = error?.response?.status;
                    if (status === 401 || status === 403) {
                        localStorage.removeItem('token');
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                    }
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (tokens: { access: string; refresh?: string }) => {
        localStorage.setItem('token', tokens.access);  // Store as 'token' to match API interceptor
        localStorage.setItem('access_token', tokens.access);  // Also store as 'access_token' for compatibility
        if (tokens.refresh) {
            localStorage.setItem('refresh_token', tokens.refresh);
        }

        const profile = await fetchProfileWithRetry();
        setUser(profile);
        return profile;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
            isAdmin: !!user && (user.role === "Admin" || user.is_superuser === true),
            isSeller: !!user && user.role === "Seller",
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
