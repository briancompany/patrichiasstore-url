import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: string;
  product_id: string;
  reviewer_name: string;
  reviewer_email: string;
  rating: number;
  review_text: string | null;
  is_approved: boolean;
  created_at: string;
}

export default function ReviewsManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('product_reviews')
      .select('*')
      .order('created_at', { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  const updateReview = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from('product_reviews')
      .update({ is_approved: approved })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update review');
    } else {
      toast.success(approved ? 'Review approved' : 'Review rejected');
      fetchReviews();
    }
  };

  const deleteReview = async (id: string) => {
    const { error } = await supabase.from('product_reviews').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Review deleted');
      fetchReviews();
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reviews</h1>
          <p className="text-muted-foreground">Approve or reject customer reviews</p>
        </div>

        <div className="grid gap-4">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No reviews yet
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{review.reviewer_name}</span>
                        <span className="text-xs text-muted-foreground">{review.reviewer_email}</span>
                        <Badge variant={review.is_approved ? 'default' : 'secondary'}>
                          {review.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-muted-foreground">{review.review_text}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!review.is_approved && (
                        <Button size="sm" onClick={() => updateReview(review.id, true)} className="gap-1">
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                      )}
                      {review.is_approved && (
                        <Button size="sm" variant="outline" onClick={() => updateReview(review.id, false)} className="gap-1">
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => deleteReview(review.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
