import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface CustomerProfile {
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile_photo?: string;
  email_notifications?: boolean;
  language?: string;
  currency?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  customer_profile?: CustomerProfile;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  userName: string;
  profilePhoto: string;
  login: (email: string, password: string) => Promise<void>;
  completeSocialLogin: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  setProfilePhoto: (photo: string) => Promise<void>;
  updateProfile: (data: Partial<CustomerProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  userName: "",
  profilePhoto: "",
  login: async () => {},
  completeSocialLogin: async () => {},
  logout: () => {},
  setProfilePhoto: async () => {},
  updateProfile: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("access_token"));
  const [user, setUser] = useState<User | null>(null);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get("/auth/customer/profile/");
      setUser(response.data);
      setIsLoggedIn(true);
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      fetchUserProfile();
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/token/", { email, password });
      const { access, refresh } = response.data;
      
      await completeSocialLogin(access, refresh);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const completeSocialLogin = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    await fetchUserProfile();
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  };

  const setProfilePhoto = async (photo: string) => {
    try {
      await api.patch("/auth/customer/profile/", {
        customer_profile: { profile_photo: photo }
      });
      await fetchUserProfile();
    } catch (error) {
      console.error("Failed to update profile photo:", error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<CustomerProfile>) => {
    try {
      await api.patch("/auth/customer/profile/", {
        customer_profile: data
      });
      await fetchUserProfile();
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  };

  const userName = user?.customer_profile?.first_name 
    ? `${user.customer_profile.first_name} ${user.customer_profile.last_name || ''}`.trim()
    : user?.username || "";

  const profilePhoto = user?.customer_profile?.profile_photo || "";

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      user,
      userName, 
      profilePhoto, 
      login, 
      completeSocialLogin,
      logout, 
      setProfilePhoto,
      updateProfile,
      refreshUser: fetchUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
