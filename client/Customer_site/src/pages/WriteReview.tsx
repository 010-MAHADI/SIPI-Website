import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Star, Upload, X } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders } from "@/context/OrderContext";
import { useSubmitReview } from "@/hooks/useReviews";
import { toast } from "@/hooks/use-toast";
import TakaSign from "@/components/TakaSign";

const WriteReview = () => {
  const { orderId, itemId } = useParams();
  const navigate = useNavigate();
  const { orders } = useOrders();
  const submitReview = useSubmitReview();

  const order = orders.find((o) => o.order_id === orderId);
  const item = order?.items.find((i) => i.id === Number(itemId));

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  if (!order || !item) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[900px] mx-auto px-4 py-20 text-center">
          <Star className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Item not found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            The item you're trying to review could not be found.
          </p>
          <Link to="/orders" className="text-primary font-medium hover:underline">
            Back to Orders
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast({
        title: "Too many images",
        description: "You can upload up to 5 images only.",
        variant: "destructive",
      });
      return;
    }

    setImages([...images, ...files]);

    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a rating.",
        variant: "destructive",
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "Review required",
        description: "Please write your review.",
        variant: "destructive",
      });
      return;
    }

    try {
      await submitReview.mutateAsync({
        productId: item.product || 0,
        rating,
        text: `${title.trim() ? title.trim() + '\n\n' : ''}${comment.trim()}`,
        images: images.length > 0 ? images : undefined,
      });
      toast({
        title: "Review submitted",
        description: "Thank you for your review!",
      });
      navigate(`/order/${orderId}`);
    } catch (error: any) {
      toast({
        title: "Failed to submit",
        description: error?.response?.data?.detail || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[700px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Link
          to={`/order/${orderId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Order
        </Link>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" /> Write a Review
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Order #{order.order_id}
          </p>
        </div>

        {/* Product Info */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <div className="flex gap-3 items-center">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
              <img
                src={
                  item.product_details?.image_url ||
                  item.product_image_url ||
                  "/placeholder.svg"
                }
                alt={item.product_title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-2">
                {item.product_title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Qty: {item.quantity} · <TakaSign />{parseFloat(item.price).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">Your Rating</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent"}
            </p>
          )}
        </div>

        {/* Review Title */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">
            Review Title <span className="text-muted-foreground text-xs">(optional)</span>
          </h3>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarize your experience..."
            maxLength={100}
            className="w-full border border-border rounded-lg p-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {title.length}/100
          </p>
        </div>

        {/* Review Comment */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">Your Review</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this product..."
            maxLength={1000}
            className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-32 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {comment.length}/1000
          </p>
        </div>

        {/* Images */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">
            Add Photos <span className="text-muted-foreground text-xs">(optional, max 5)</span>
          </h3>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {images.length < 5 && (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload images</p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG up to 5MB each
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitReview.isPending}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitReview.isPending ? "Submitting..." : "Submit Review"}
        </button>
      </main>
      <SiteFooter />
    </div>
  );
};

export default WriteReview;
