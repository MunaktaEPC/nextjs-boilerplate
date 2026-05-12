"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Post {
  id: string;
  created_at: string;
  title: string;
  content: string;
  image_url: string;
  author_name: string;
  author_avatar: string;
  category: string;
  genre?: string;
  parent_id?: string;
  likes?: number;
}

export default function RoboCupPortalComplete() {
  const [view, setView] = useState<'home' | 'bbs' | 'bbs_read' | 'blog_list' | 'blog_write' | 'blog_read' | 'profile'>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const [isNewGenre, setIsNewGenre] = useState(false);

  // 【重要】各テキストエリア用のRef
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);

  useEffect(() => {
    const savedName = localStorage.getItem('robocup_name');
    const savedAvatar = localStorage.getItem('robocup_avatar');
    const savedAdmin = localStorage.getItem('robocup_is_admin') === 'true';
    const savedLikes = JSON.parse(localStorage.getItem('robocup_liked_ids') || '[]');
    if (savedName) setProfileName(savedName);
    if (savedAvatar) { setProfileAvatar(savedAvatar); setAvatarPreview(savedAvatar); }
    if (savedAdmin) setIsAdmin(true);
    setLikedPosts(savedLikes);
    fetchData();
  }, []);

  async function fetchData() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]);
  }

  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const existingGenres = useMemo(() => {
    const gs = Array.from(new Set(blogArticles.map(a => a.genre || '未分類')));
    return gs.filter(g => g !== '未分類').sort();
  }, [blogArticles]);

  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function uploadFile(file: File) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // 【修正】画像挿入ロジック（targetで宛先を切り替え）
  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'reply') {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadFile(file);
    if (res) {
      const tag = file.type.startsWith('image/') ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      const textarea = target === 'post' ? textareaRef.current : replyTextareaRef.current;
      const currentVal = target === 'post' ? content : replyContent;
      const setter = target === 'post' ? setContent : setReplyContent;

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setter(currentVal.substring(0, start) + tag + currentVal.substring(end));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        setter(prev => prev + tag);
      }
    }
    setLoading(false);
    e.target.value = ''; 
  }

  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) return;
    const newList = [...likedPosts, post.id];
    setLikedPosts(newList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newList));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p));
  }

  async function saveProfile() {
    setLoading(true);
    let url = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) url = res.url;
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', url);
    setProfileAvatar(url);
    const isNowAdmin = adminPassInput === 'admin1234';
    localStorage.setItem('robocup_is_admin', isNowAdmin ? 'true' : 'false');
    setIsAdmin(isNowAdmin);
    alert("保存しました");
    setView('home');
    setLoading(false);
  }

  async function handleDelete(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', id);
    await fetchData();
  }

  async function handleBbsSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setTitle(''); setContent('');
    await fetchData();
    setView('bbs');
    setLoading(false);
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setReplyContent(''); 
    await fetchData();
    setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ title, content, image_url: coverPreview, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類' }]);
    setTitle(''); setContent(''); setCoverPreview(''); setGenre('未分類');
    await fetchData();
    setView('blog_list'); 
    setLoading(false);
  }

  const renderContent = (text: string) => {
    if (!text) return null;
    return text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g).map((part, i) => {
      const img = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (img) return <img key={i} src={img[2]} style={{ maxWidth: '100%', borderRadius: '10px', margin: '10px 0', display: 'block' }} />;
      const file = part.match(/\[(.*?)\]\((.*?)\)/);
      if (file) return <a key={i} href={file[2]} target="_blank" style={{ color: '#5a3d8a', fontWeight: 'bold' }}>📎 {file[1]}</a>;
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 onClick={() => setView('home')} style={{ cursor: 'pointer', color: '#5a3d8a' }}>ロボカップポータル</h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', backgroundColor: '#f3eef7', padding: '8px 15px', borderRadius: '20px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
          <span>{profileName}</span>
        </div>
      </header>

      <nav style={{ padding: '10px 40px', backgroundColor: '#fff', display: 'flex', gap: '10px' }}>
        <button onClick={() => setView('home')}>ホーム</button>
        <button onClick={() => setView('bbs')}>掲示板</button>
        <button onClick={() => setView('blog_list')}>ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px' }}>
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div onClick={() => setView('bbs')} style={{ padding: '40px', backgroundColor: '#fff', textAlign: 'center', borderRadius: '20px', cursor: 'pointer' }}><h2>掲示板</h2></div>
            <div onClick={() => setView('blog_list')} style={{ padding: '40px', backgroundColor: '#fff', textAlign: 'center', borderRadius: '20px', cursor: 'pointer' }}><h2>ブログ</h2></div>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
              <h3>新規スレッド</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', marginBottom: '10px' }} />
              <label style={{ cursor: 'pointer', background: '#eee', padding: '5px 10px', display: 'inline-block', marginBottom: '5px' }}>
                📸 画像挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} />
              </label>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} style={{ width: '100%', height: '100px' }} />
              <button onClick={handleBbsSubmit} style={{ marginTop: '10px' }}>投稿</button>
            </div>
            {mainThreads.map(t => (
              <div key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ background: '#fff', padding: '15px', marginBottom: '10px', borderRadius: '10px', cursor: 'pointer' }}>
                <h4>{t.title}</h4>
                <small>{t.author_name} - {new Date(t.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')}>← 戻る</button>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', margin: '20px 0' }}>
              <h2>{activeThread.title}</h2>
              <div>{renderContent(activeThread.content)}</div>
              <hr />
              {getReplies(activeThread.id).map(r => (
                <div key={r.id} style={{ marginBottom: '15px' }}>
                  <b>{r.author_name}</b>: {renderContent(r.content)}
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '15px' }}>
              <label style={{ cursor: 'pointer', background: '#eee', padding: '5px 10px', display: 'inline-block' }}>
                📸 画像挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'reply')} style={{ display: 'none' }} />
              </label>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} style={{ width: '100%', height: '80px' }} />
              <button onClick={() => handleReplySubmit(activeThread.id)}>返信</button>
            </div>
          </div>
        )}

        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '20px' }}>
            <aside style={{ width: '200px' }}>
              <h3>📁 ジャンル</h3>
              <div onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', fontWeight: !selectedGenre ? 'bold' : 'normal' }}>すべて</div>
              {existingGenres.map(g => <div key={g} onClick={() => setSelectedGenre(g)} style={{ cursor: 'pointer', fontWeight: selectedGenre === g ? 'bold' : 'normal' }}>{g}</div>)}
            </aside>
            <div style={{ flexGrow: 1 }}>
              <button onClick={() => setView('blog_write')}>＋ 記事を書く</button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <div key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ height: '150px', background: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '10px' }}><b>{a.title}</b><br/><small>{a.genre}</small></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <div style={{ background: '#fff', padding: '40px', borderRadius: '20px' }}>
            <button onClick={() => setView('blog_list')}>← 戻る</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '10px', margin: '20px 0' }} />}
            <h1>{activeArticle.title}</h1>
            <div style={{ lineHeight: '1.8' }}>{renderContent(activeArticle.content)}</div>
            <button onClick={() => handleLike(activeArticle)} style={{ marginTop: '20px' }}>❤️ {activeArticle.likes || 0}</button>
          </div>
        )}

        {view === 'blog_write' && (
          <div style={{ background: '#fff', padding: '30px', borderRadius: '20px' }}>
            <button onClick={() => setView('blog_list')}>キャンセル</button>
            <div style={{ height: '200px', border: '2px dashed #ccc', margin: '20px 0', position: 'relative' }}>
              {coverPreview && <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const res = await uploadFile(f); if (res) setCoverPreview(res.url); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <input type="text" placeholder="ジャンル" value={genre} onChange={(e) => setGenre(e.target.value)} />
            </div>
            <label style={{ cursor: 'pointer', background: '#eee', padding: '5px 10px', display: 'inline-block' }}>📸 本文に画像挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} /></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '24px', margin: '10px 0' }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} style={{ width: '100%', height: '300px' }} />
            <button onClick={handleBlogSubmit} style={{ width: '100%', marginTop: '20px' }}>公開</button>
          </div>
        )}

        {view === 'profile' && (
          <div style={{ maxWidth: '400px', margin: '0 auto', background: '#fff', padding: '30px', borderRadius: '20px' }}>
            <h2>プロフィール設定</h2>
            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="名前" style={{ width: '100%', marginBottom: '10px' }} />
            <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
            <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="管理パスワード" style={{ width: '100%', margin: '10px 0' }} />
            <button onClick={saveProfile} style={{ width: '100%' }}>保存</button>
          </div>
        )}
      </main>
    </div>
  );
}
