import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";
import { Store, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";

const MAX_SHOPS = 5;

// Fallback categories if API fails
const fallbackCategories = [
  "Electronics",
  "Clothing & Fashion",
  "Home & Garden",
  "Sports & Outdoors",
  "Beauty & Personal Care",
  "Books & Media",
  "Toys & Games",
  "Food & Beverages",
  "Health & Wellness",
  "Automotive",
];

const emojiOptions = ["🏪", "🛍️", "🏬", "🎯", "💼", "🎨", "⚡", "🌟", "🔥", "💎", "🚀", "🎁"];

interface Category {
  id: number;
  name: string;
  slug: string;
}

export default function CreateShop() {
  const navigate = useNavigate();
  const { shops, addShop, setCurrentShop } = useShop();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    logo: "🏪",
    category: "",
    description: "",
  });

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/products/categories/');
        const categoryData = response.data?.results || response.data || [];

        if (Array.isArray(categoryData) && categoryData.length > 0) {
          setCategories(categoryData);
        } else {
          // Create fallback categories if none exist
          console.warn('No categories found, using fallback categories');
          const fallbackCategoryObjects = fallbackCategories.map((name, index) => ({
            id: index + 1,
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
          }));
          setCategories(fallbackCategoryObjects);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        // Use fallback categories
        const fallbackCategoryObjects = fallbackCategories.map((name, index) => ({
          id: index + 1,
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
        }));
        setCategories(fallbackCategoryObjects);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user?.role !== "Seller") {
      toast.error("Only seller accounts can create shops.");
      navigate("/");
      return;
    }

    if (shops.length >= MAX_SHOPS) {
      toast.error(`You can create up to ${MAX_SHOPS} shops only.`);
      navigate("/shop-selector");
      return;
    }

    if (!formData.name || !formData.category || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Find the selected category object to get its ID
      const selectedCategory = categories.find(cat => cat.id.toString() === formData.category);
      
      // Create shop in backend
      const response = await api.post('/products/shops/', {
        name: formData.name,
        category: selectedCategory ? selectedCategory.id : parseInt(formData.category), // Send category ID
        description: formData.description,
        status: 'active',
      });

      console.log("Shop created:", response.data);

      // Add shop to local context with backend ID
      const newShop = {
        id: response.data.id.toString(),
        name: response.data.name,
        logo: formData.logo,
        category: selectedCategory ? selectedCategory.name : formData.category,
        description: response.data.description,
        status: response.data.status as "active" | "inactive",
        createdAt: response.data.createdDate || new Date().toISOString(),
      };

      addShop(newShop);
      setCurrentShop(newShop);
      toast.success("Shop created successfully!");
      navigate("/");
    } catch (error: any) {
      console.error("Failed to create shop:", error);
      console.error("Error response:", error.response?.data);
      
      let errorMessage = "Failed to create shop. Please try again.";
      
      if (error.response?.data) {
        const data = error.response.data;
        if (data.category && Array.isArray(data.category)) {
          errorMessage = `Category error: ${data.category[0]}`;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.name && Array.isArray(data.name)) {
          errorMessage = `Name error: ${data.name[0]}`;
        } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMessage = data.non_field_errors[0];
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Create New Shop</h1>
          <p className="text-muted-foreground">
            Set up your shop details to start selling
          </p>
        </div>

        {/* Form */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Shop Logo */}
            <div className="space-y-2">
              <Label htmlFor="logo">Shop Logo (Emoji)</Label>
              <div className="grid grid-cols-6 gap-2">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, logo: emoji })}
                    className={`h-12 w-12 rounded-lg border-2 text-2xl hover:border-primary transition-all ${
                      formData.logo === emoji
                        ? "border-primary bg-primary/10 scale-110"
                        : "border-border"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Shop Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Shop Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter your shop name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                disabled={loadingCategories}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select a category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what your shop sells..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/shop-selector")}
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting || loadingCategories}>
                <Store className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Create Shop"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}