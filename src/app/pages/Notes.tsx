import React, { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { StickyNote, PlusCircle, Search, Trash2, X, Plus, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Note } from '../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useMonthRange } from '../contexts/MonthRangeContext';
import { queryKeys } from '../lib/queryClient';

export function Notes() {
  const { user } = useAuth();
  const { monthOptions } = useMonthRange();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterMonthYear, setFilterMonthYear] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const ITEMS_PER_PAGE = 10;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Notes list: cached per filter (and the default view kept in the browser,
  // see lib/queryPersist.ts), ITEMS_PER_PAGE per page
  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.noteList(user?.id, { month: filterMonthYear, search: debouncedSearchTerm }),
    enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('notes')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + ITEMS_PER_PAGE - 1);

      if (filterMonthYear) {
        const [year, month] = filterMonthYear.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        query = query.gte('created_at', `${filterMonthYear}-01T00:00:00`).lte('created_at', `${filterMonthYear}-${lastDay}T23:59:59`);
      }

      if (debouncedSearchTerm) {
        query = query.or(`title.ilike.%${debouncedSearchTerm}%,content.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Note[];
      return { rows, nextOffset: rows.length === ITEMS_PER_PAGE ? pageParam + ITEMS_PER_PAGE : undefined };
    },
    getNextPageParam: (last) => last.nextOffset,
  });

  const notes = useMemo(() => listQuery.data?.pages.flatMap(p => p.rows) ?? [], [listQuery.data]);
  const loading = listQuery.isPending;
  const hasMore = listQuery.hasNextPage;
  const isFetchingMore = listQuery.isFetchingNextPage;
  const handleLoadMore = () => listQuery.fetchNextPage();
  const refreshNotes = () => queryClient.invalidateQueries({ queryKey: queryKeys.notes(user?.id) });

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return toast.error('Title is required');

    try {
      if (selectedNote) {
        const { error } = await supabase
          .from('notes')
          .update({ title, content })
          .eq('id', selectedNote.id);
        if (error) throw error;
        toast.success('Note updated');
      } else {
        const { error } = await supabase
          .from('notes')
          .insert([{ user_id: user?.id, title, content }]);
        if (error) throw error;
        toast.success('Note created');
      }
      setIsCreating(false);
      setSelectedNote(null);
      setTitle('');
      setContent('');
      refreshNotes();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteToDelete.id);
      if (error) throw error;
      toast.success('Note deleted');
      refreshNotes();
    } catch (error: any) {
      toast.error('Error deleting note');
    } finally {
      setNoteToDelete(null);
    }
  };

  const openEdit = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setIsCreating(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Daily Notes</h1>
          <p className="text-muted-foreground">Jot down your daily thoughts and financial reflections.</p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setSelectedNote(null); setTitle(''); setContent(''); }}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          <PlusCircle size={20} />
          Add Note
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
          <input
            type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your notes..."
            className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:ring-2 ring-primary/20 transition-all placeholder:font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2 hover:border-primary/50 transition-colors shrink-0">
          <Calendar className="text-muted-foreground" size={20} />
          <select 
            value={filterMonthYear} onChange={(e) => setFilterMonthYear(e.target.value)}
            className="bg-transparent font-bold outline-none cursor-pointer appearance-none pr-4"
          >
            <option value="">All Time</option>
            {monthOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="col-span-full bg-card border border-border border-dashed rounded-3xl p-12 text-center">
            <StickyNote className="mx-auto mb-4 text-muted-foreground opacity-20" size={48} />
            <h3 className="font-bold text-lg">No notes found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your filters or write a new note.</p>
            {searchTerm || filterMonthYear ? (
              <button onClick={() => { setSearchTerm(''); setFilterMonthYear(''); }} className="mt-4 text-primary font-bold hover:underline">
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className="bg-card border border-border rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group h-44 sm:h-64"
            >
              <div onClick={() => openEdit(note)} className="cursor-pointer flex-1 overflow-hidden">
                <h3 className="text-sm sm:text-lg font-black mb-1 sm:mb-2 line-clamp-1">{note.title}</h3>
                <p className="text-[10px] sm:text-sm text-muted-foreground line-clamp-3 sm:line-clamp-5 whitespace-pre-wrap">{note.content}</p>
              </div>
              <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-border mt-2 sm:mt-4">
                <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground">{new Date(note.created_at).toLocaleDateString('en-GB')}</span>
                <button
                  onClick={() => setNoteToDelete(note)}
                  className="p-1.5 sm:p-2 text-muted-foreground hover:text-rose-600 transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && notes.length > 0 && (
        <div className="flex justify-center pt-8">
          <button
            onClick={handleLoadMore}
            disabled={isFetchingMore}
            className="bg-accent/50 hover:bg-accent border border-border px-8 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
          >
            {isFetchingMore ? 'Loading more...' : 'Load More Notes'}
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsCreating(false)}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-xl font-black">{selectedNote ? 'Edit Note' : 'Create Note'}</h3>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-accent rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveNote} className="p-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground">Title</label>
                  <input
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note Title..."
                    className="w-full bg-field border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    autoFocus
                  />
                </div>
                <div className="flex-1 flex flex-col space-y-2">
                  <label className="text-xs font-black text-muted-foreground">Content</label>
                  <textarea
                    value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your note here..."
                    className="flex-1 w-full bg-field border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none min-h-[300px]"
                  />
                </div>
                <button type="submit" className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg transition-all hover:bg-primary/90">
                  {selectedNote ? 'Save Changes' : 'Add Note'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={!!noteToDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note? This can't be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteNote}
        onCancel={() => setNoteToDelete(null)}
      />
    </motion.div>
  );
}
