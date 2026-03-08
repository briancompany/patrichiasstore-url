import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeText } from '@/lib/security';

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

export function ProductReviews({ productId, productName }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('product_reviews')
      .select('id, reviewer_name, rating, review_text, created_at')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      setReviews(data);
      setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || rating === 0) {
      toast.error('Please fill in name, email, and rating');
      return;
    }
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('product_reviews').insert({
      product_id: productId,
      reviewer_name: sanitizeText(name.trim()),
      reviewer_email: email.trim().toLowerCase(),
      rating,
      review_text: reviewText.trim() ? sanitizeText(reviewText.trim()) : null,
    });

    if (error) {
      toast.error('Failed to submit review');
    } else {
      toast.success('Review submitted! It will appear after approval.');
      setShowForm(false);
      setName('');
      setEmail('');
      setRating(0);
      setReviewText('');
    }
    setSubmitting(false);
  };

  const StarRating = ({ value, interactive = false }: { value: number; interactive?: boolean }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= (interactive ? (hoverRating || rating) : Math.round(value))
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/30'
          } ${interactive ? 'cursor-pointer h-6 w-6' : ''}`}
          onClick={interactive ? () => setRating(star) : undefined}
          onMouseEnter={interactive ? () => setHoverRating(star) : undefined}
          onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarRating value={avgRating} />
          <span className="text-xs text-muted-foreground">
            {reviews.length > 0 ? `${avgRating.toFixed(1)} (${reviews.length})` : 'No reviews yet'}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)} className="text-xs">
          Write Review
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <StarRating value={rating} interactive />
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-sm"
          />
          <Textarea
            placeholder="Write your review (optional)"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="text-sm min-h-[60px]"
          />
          <Button onClick={handleSubmit} disabled={submitting} size="sm" className="w-full gap-2">
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Submit Review
          </Button>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {reviews.slice(0, 3).map((review) => (
            <div key={review.id} className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <StarRating value={review.rating} />
                <span className="font-medium">{review.reviewer_name}</span>
              </div>
              {review.review_text && (
                <p className="text-muted-foreground">{review.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StarRatingDisplay({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${
            star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
      {count > 0 && <span className="text-xs text-muted-foreground ml-1">({count})</span>}
    </div>
  );
}
