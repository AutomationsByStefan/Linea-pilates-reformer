import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MessageSquare, Check, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AllTrainingsPage = () => {
  const navigate = useNavigate();
  const [upcomingTrainings, setUpcomingTrainings] = useState([]);
  const [pastTrainings, setPastTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentOpen, setCommentOpen] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    try {
      const [upcomingRes, pastRes] = await Promise.all([
        fetch(`${API}/trainings/upcoming`, { credentials: 'include' }),
        fetch(`${API}/trainings/past`, { credentials: 'include' })
      ]);
      if (upcomingRes.ok) setUpcomingTrainings(await upcomingRes.json());
      if (pastRes.ok) setPastTrainings(await pastRes.json());
    } catch (error) {
      console.error('Error fetching trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Cetvrtak', 'Petak', 'Subota'];
    const months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
    return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
  };

  const handleSaveComment = async (trainingId) => {
    if (!commentText.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetch(`${API}/trainings/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ training_id: trainingId, komentar: commentText.trim() })
      });
      if (res.ok) {
        toast.success('Komentar sacuvan');
        setPastTrainings(prev => prev.map(t =>
          t.id === trainingId ? { ...t, komentar: commentText.trim() } : t
        ));
        setCommentOpen(null);
        setCommentText('');
      } else {
        toast.error('Greska pri cuvanju komentara');
      }
    } catch { toast.error('Greska'); }
    finally { setSavingComment(false); }
  };

  const openComment = (training) => {
    if (commentOpen === training.id) {
      setCommentOpen(null);
      setCommentText('');
    } else {
      setCommentOpen(training.id);
      setCommentText(training.komentar || '');
    }
  };

  const UpcomingCard = ({ training }) => (
    <div className="card-linea" data-testid="upcoming-training-card">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center flex-shrink-0">
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground mb-1">{formatDate(training.datum)}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {training.vrijeme}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Instruktor: Marija Trisic</p>
        </div>
      </div>
    </div>
  );

  const PastCard = ({ training }) => (
    <div className="card-linea" data-testid="past-training-card">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
          <Check className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-foreground mb-1">{formatDate(training.datum)}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {training.vrijeme}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Instruktor: Marija Trisic</p>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Iskoristen</span>
          </div>

          {/* Existing comment display */}
          {training.komentar && commentOpen !== training.id && (
            <div className="mt-3 p-2.5 bg-secondary/50 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">Tvoj komentar:</p>
              <p className="text-sm text-foreground">{training.komentar}</p>
            </div>
          )}

          {/* Comment button */}
          <button
            onClick={() => openComment(training)}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            data-testid="toggle-comment-btn"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {training.komentar ? 'Izmijeni komentar' : 'Dodaj komentar'}
          </button>

          {/* Comment input */}
          {commentOpen === training.id && (
            <div className="mt-2 space-y-2" data-testid="comment-input-section">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Kako si se osjecao/la na treningu?"
                className="w-full p-3 rounded-xl border border-[#E8E2D8] bg-white text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 outline-none focus:border-primary"
                data-testid="comment-textarea"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => { setCommentOpen(null); setCommentText(''); }}
                  className="h-8 text-xs"
                >
                  Otkazi
                </Button>
                <Button
                  onClick={() => handleSaveComment(training.id)}
                  disabled={savingComment || !commentText.trim()}
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-white"
                  data-testid="save-comment-btn"
                >
                  <Send className="w-3 h-3 mr-1" />
                  {savingComment ? 'Cuvanje...' : 'Sacuvaj'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="all-trainings-page">
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors" data-testid="trainings-back-btn">
            <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-heading text-xl text-foreground ml-3">Tvoji treninzi</h1>
        </div>
      </header>

      <div className="px-6 py-6">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 p-1 rounded-full h-12">
            <TabsTrigger value="upcoming" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all" data-testid="upcoming-tab">
              Predstojeci
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all" data-testid="past-tab">
              Iskoristeni
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="card-linea animate-pulse h-24" />)
            ) : upcomingTrainings.length > 0 ? (
              upcomingTrainings.map(t => <UpcomingCard key={t.id} training={t} />)
            ) : (
              <div className="card-linea text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nemate zakazanih treninga</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="card-linea animate-pulse h-24" />)
            ) : pastTrainings.length > 0 ? (
              pastTrainings.map(t => <PastCard key={t.id} training={t} />)
            ) : (
              <div className="card-linea text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nemate iskoristenih treninga</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AllTrainingsPage;
