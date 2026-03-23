import { useMemo, useState, useRef } from "react";
import { ArrowLeft, Edit, MoreHorizontal, Package, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  useUploadCategoryImage,
  type Category,
} from "@/hooks/useCategories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop";

export default function Categories() {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const uploadImage = useUploadCategoryImage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)),
    [categories]
  );

  const handleImageSelect = (file: File, isEdit: boolean = false) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditImageFile(file);
        setEditImagePreview(reader.result as string);
      } else {
        setImageFile(file);
        setImagePreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (isEdit: boolean = false) => {
    if (isEdit) {
      setEditImageFile(null);
      setEditImagePreview(null);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    } else {
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      is_active: true,
      sort_order: 0,
    };

    try {
      const newCategory = await createCategory.mutateAsync(payload);
      
      // Upload image if selected
      if (imageFile && newCategory.id) {
        try {
          await uploadImage.mutateAsync({ categoryId: newCategory.id, file: imageFile });
          toast.success("Category and image added successfully");
        } catch (uploadError: any) {
          console.error("Failed to upload image:", uploadError);
          toast.warning("Category created but image upload failed");
        }
      } else {
        toast.success("Category added successfully");
      }
      
      setDialogOpen(false);
      clearImage(false);
    } catch (error: any) {
      console.error("Failed to add category:", error);
      const errorMessage = error.response?.data?.name?.[0] || 
                          error.response?.data?.detail || 
                          "Failed to add category";
      toast.error(errorMessage);
    }
  };

  const handleEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDialog) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
    };

    try {
      await updateCategory.mutateAsync({ id: editDialog.id, payload });
      
      // Upload new image if selected
      if (editImageFile) {
        try {
          await uploadImage.mutateAsync({ categoryId: editDialog.id, file: editImageFile });
          toast.success("Category and image updated successfully");
        } catch (uploadError: any) {
          console.error("Failed to upload image:", uploadError);
          toast.warning("Category updated but image upload failed");
        }
      } else {
        toast.success("Category updated successfully");
      }
      
      setEditDialog(null);
      clearImage(true);
    } catch (error: any) {
      console.error("Failed to update category:", error);
      const errorMessage = error.response?.data?.name?.[0] || 
                          error.response?.data?.detail || 
                          "Failed to update category";
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast.success("Category deleted");
      if (selectedCategory?.id === id) {
        setSelectedCategory(null);
      }
    } catch {
      toast.error("Failed to delete category");
    }
  };

  const toggleStatus = async (category: Category) => {
    const nextStatus = !category.is_active;
    try {
      await updateCategory.mutateAsync({ id: category.id, payload: { is_active: nextStatus } });
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (selectedCategory) {
    const categoryProducts = categories.find(c => c.id === selectedCategory.id);
    const products = (categoryProducts as any)?.products || [];
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedCategory(null)}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{selectedCategory.name}</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} products
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-lg"
            onClick={() => navigate(`/products/new?category=${selectedCategory.id}`)}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Product
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No products in this category</p>
            <p className="text-sm text-muted-foreground/60">
              Products with this category will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <div
                key={product.id}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-all"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-sm text-foreground">{product.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-primary">
                      ${Number(product.originalPrice ?? product.price).toFixed(2)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Sold {product.sold_count}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>Categories</h1>
          <p>{sortedCategories.length} categories</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) clearImage(false);
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg">
              <Plus className="h-4 w-4 mr-1.5" /> Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input id="name" name="name" required placeholder="e.g. Electronics" className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description"
                  className="rounded-lg resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Category Image</Label>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative rounded-lg border border-border overflow-hidden">
                      <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                      <button
                        type="button"
                        onClick={() => clearImage(false)}
                        className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload image</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Max 2MB (JPG, PNG, WEBP, GIF)</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], false)}
                    className="hidden"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="rounded-lg" disabled={createCategory.isPending || uploadImage.isPending}>
                  {createCategory.isPending || uploadImage.isPending ? 'Creating...' : 'Create Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editDialog} onOpenChange={(open) => {
        if (!open) {
          setEditDialog(null);
          clearImage(true);
        }
      }}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name *</Label>
                <Input name="name" defaultValue={editDialog.name} required className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  name="description"
                  defaultValue={editDialog.description || ''}
                  className="rounded-lg resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Category Image</Label>
                <div className="space-y-3">
                  {editImagePreview || editDialog.image_url ? (
                    <div className="relative rounded-lg border border-border overflow-hidden">
                      <img 
                        src={editImagePreview || editDialog.image_url || ''} 
                        alt="Preview" 
                        className="w-full h-48 object-cover" 
                      />
                      {editImagePreview && (
                        <button
                          type="button"
                          onClick={() => clearImage(true)}
                          className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => editFileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload new image</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Max 2MB (JPG, PNG, WEBP, GIF)</p>
                    </div>
                  )}
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], true)}
                    className="hidden"
                  />
                  {!editImagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full rounded-lg"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Change Image
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="rounded-lg" disabled={updateCategory.isPending || uploadImage.isPending}>
                  {updateCategory.isPending || uploadImage.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedCategories.map((category) => {
            const imageUrl = category.image_url || FALLBACK_IMAGE;
            return (
              <div
                key={category.id}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setSelectedCategory(category)}
              >
                <div className="relative h-44 overflow-hidden bg-muted">
                  <img
                    src={imageUrl}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-primary-foreground">{category.name}</h3>
                      <p className="text-xs text-primary-foreground/80">
                        {category.slug}
                      </p>
                    </div>
                    <Badge
                      variant={category.is_active ? "default" : "secondary"}
                      className="text-xs capitalize"
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {category.description || "No description"}
                  </p>
                  <div className="flex items-center justify-between" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => toggleStatus(category)}
                    >
                      {category.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditDialog(category)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(category.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
          {sortedCategories.length === 0 && (
            <div className="stat-card py-10 text-center text-muted-foreground col-span-full">
              No categories found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
