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

export default function RoboCupPortal() {
  const [view, setView] = useState<'home' | 'bbs' | 'bbs_read' | 'blog_list' | 'blog_write' | 'blog_read' | 'profile'>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  
  // プロフィール関連のステート（完全維持）
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const [isNewGenre, setIsNewGenre] = useState(false);
  
  const bbsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blogTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);

  // いいね管理用
  const [likedPosts, setLikedPosts] = useState<string[]>([]);

  useEffect(() => {
    const savedName = localStorage.getItem('robocup_name');
    const savedAvatar = localStorage.getItem('robocup_avatar');
    const savedAdmin = localStorage.getItem('robocup_is_admin') === 'true';
    const savedLikes = JSON.parse(localStorage.getItem('robocup_liked_ids') || '[]');
    
    if (savedName) setProfileName(savedName);
    if (savedAvatar) setProfileAvatar(savedAvatar);
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
    const fileName = `${Math.random()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  const insertTextAtCursor = (ref: React.RefObject<HTMLTextAreaElement | null>, text: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const textarea = ref.current;
    if (!textarea) { setter(prev => prev + text); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setter(prev => prev.substring(0, start) + text + prev.substring(end));
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + text.length, start + text.length); }, 10);
  };

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLTextAreaElement | null>, setter: React.Dispatch<React.SetStateAction<string>>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (res) {
      const tag = file.type.startsWith('image/') ? `\n![${res.name}](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      insertTextAtCursor(ref, tag, setter);
    }
    e.target.value = '';
  }

  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) {
      alert("いいねは1回までです。");
      return;
    }
    const newLikes = (post.likes || 0) + 1;
    const newLikedList = [...likedPosts, post.id];
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    if (activeArticle?.id === post.id) setActiveArticle({ ...activeArticle, likes: newLikes });
    setLikedPosts(newLikedList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newLikedList));
    await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
  }

  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) { newAvatarUrl = res.url; setProfileAvatar(newAvatarUrl); }
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', newAvatarUrl);
    if (adminPassInput === 'admin1234') {
      localStorage.setItem('robocup_is_admin', 'true');
      setIsAdmin(true);
    }
    setAdminPassInput('');
    alert("保存しました");
    setView('home');
    setLoading(false);
  }

  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("本当に削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', id);
    await supabase.from('posts').delete().eq('parent_id', id);
    if (activeThread?.id === id) setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
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

  async function handleReplySubmit(parentId: string, currentSetter: React.Dispatch<React.SetStateAction<string>>, currentVal: string) {
    if (!currentVal) return;
    await supabase.from('posts').insert([{ content: currentVal, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    currentSetter(''); 
    await fetchData();
  }

  async function handleBlogSubmit() {
    if (!title || !content) return;
    setLoading(true);
    let imageUrl = imageFile ? (await uploadFile(imageFile))?.url : '';
    const { error } = await supabase.from('posts').insert([{ 
      title, 
      content, 
      image_url: imageUrl, 
      author_name: profileName, 
      author_avatar: profileAvatar, 
      category: 'blog', 
      genre: genre || '未分類', 
      likes: 0 
    }]);
    
    if (!error) {
      setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
      await fetchData(); // ここで同期的にデータを取得
      setView('blog_list'); 
    } else {
      alert("投稿に失敗しました");
    }
    setLoading(false);
  }

  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '10px 0', display: 'block' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return (
        <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '8px 12px', borderRadius: '5px', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '5px 0', fontSize: '14px' }}>
          {fileMatch[1]}
        </a>
      );
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333' }}>
      
      {/* ヘッダー：プロフィール表示を復活 */}
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#5a3d8a', fontWeight: '900' }}>ロボカップ情報共有</h1>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 15px', backgroundColor: isAdmin ? '#ffebee' : '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      <nav style={{ padding: '10px 40px', display: 'flex', gap: '10px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 20px', border: 'none', borderRadius: '5px', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🏠 Home</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 20px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 20px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#5a3d8a' }}>処理中...</div>}

        {/* HOME */}
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '15px', border: '1px solid #eee', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '15px' }}>💬</div>
              <h3 style={{ margin: 0 }}>交流掲示板</h3>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '15px', border: '1px solid #eee', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '15px' }}>🖋️</div>
              <h3 style={{ margin: 0 }}>技術ブログ</h3>
            </div>
          </div>
        )}

        {/* BBS READ */}
        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '15px' }}>← 戻る</button>
            <div style={{ backgroundColor: '#fff', borderRadius: '15px', border: '1px solid #ddd', padding: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, color: '#d32f2f' }}>{activeThread.title}</h2>
                {isAdmin && <button onClick={() => handleDeletePost(activeThread.id)} style={{ color: '#d32f2f', border: 'none', background: 'none' }}>🗑️</button>}
              </div>
              <div style={{ marginTop: '20px' }}>{renderContent(activeThread.content)}</div>
            </div>
            <div style={{ marginTop: '20px' }}>
              {getReplies(activeThread.id).map(r => (
                <div key={r.id} style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{r.author_name}</div>
                  <div>{renderContent(r.content)}</div>
                </div>
              ))}
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信..." style={{ width: '100%', marginTop: '20px', padding: '10px' }} />
              <button onClick={() => handleReplySubmit(activeThread.id, setReplyContent, replyContent)} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 20px', border: 'none', cursor: 'pointer' }}>返信</button>
            </div>
          </div>
        )}

        {/* BBS LIST */}
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '20px', borderRadius: '12px', marginBottom: '25px' }}>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドタイトル" style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
              <textarea ref={bbsTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', padding: '10px' }} />
              <button onClick={handleBbsSubmit} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 20px', border: 'none', cursor: 'pointer', marginTop: '10px' }}>投稿</button>
            </div>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #eee', cursor: 'pointer', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#d32f2f' }}>{t.title}</h4>
                <div style={{ fontSize: '12px', color: '#888' }}>{t.author_name}</div>
              </article>
            ))}
          </div>
        )}

        {/* BLOG LIST: ジャンル維持 */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '200px' }}>
              <h3 style={{ fontSize: '15px', color: '#5a3d8a', borderBottom: '2px solid #5a3d8a' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', color: !selectedGenre ? '#d32f2f' : '#555', padding: '5px 0' }}>すべて表示</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ cursor: 'pointer', color: selectedGenre === g ? '#d32f2f' : '#555', padding: '5px 0' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>技術ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '25px', cursor: 'pointer' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ height: '140px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '15px' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#5a3d8a', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{a.genre}</span>
                      <h4 style={{ margin: '10px 0' }}>{a.title}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
                        <span>{a.author_name}</span>
                        <span>❤️ {a.likes || 0}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BLOG READ: いいね数復活 */}
        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '15px', marginBottom: '20px' }} />}
            <div style={{ fontSize: '14px', color: '#5a3d8a', fontWeight: 'bold' }}>📁 {activeArticle.genre}</div>
            <h1 style={{ fontSize: '32px', margin: '10px 0' }}>{activeArticle.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
              <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div><div style={{ fontWeight: 'bold' }}>{activeArticle.author_name}</div><div style={{ fontSize: '12px', color: '#888' }}>{new Date(activeArticle.created_at).toLocaleString()}</div></div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                <button onClick={() => handleLike(activeArticle)} style={{ backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4b5c' : '#fff', border: '1px solid #ff4b5c', color: likedPosts.includes(activeArticle.id) ? '#fff' : '#ff4b5c', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer' }}>❤️ いいね {activeArticle.likes || 0}</button>
                {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ color: '#d32f2f', border: '1px solid #d32f2f', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer' }}>🗑️</button>}
              </div>
            </div>
            <div style={{ fontSize: '18px', lineHeight: '1.8' }}>{renderContent(activeArticle.content)}</div>
          </article>
        )}

        {/* BLOG WRITE */}
        {view === 'blog_write' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', marginBottom: '20px', cursor: 'pointer' }}>← 戻る</button>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>📁 ジャンル</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isNewGenre ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '10px' }}>
                    <option value="未分類">未分類</option>{existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="新規ジャンル名" style={{ flexGrow: 1, padding: '10px' }} />
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)} style={{ padding: '0 10px' }}>切替</button>
              </div>
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '24px', marginBottom: '20px', padding: '10px' }} />
            <textarea ref={blogTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', minHeight: '300px', padding: '10px' }} />
            <div style={{ marginTop: '10px' }}>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setCoverPreview(URL.createObjectURL(f)); } }} />
              {coverPreview && <img src={coverPreview} style={{ width: '100px', marginTop: '10px' }} />}
            </div>
            <button onClick={handleBlogSubmit} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', border: 'none', borderRadius: '10px', marginTop: '20px', cursor: 'pointer', fontWeight: 'bold' }}>公開する</button>
          </div>
        )}

        {/* PROFILE: ここを復旧 */}
        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2 style={{ color: '#5a3d8a' }}>設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>アイコン</label>
              <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
              {avatarPreview && <img src={avatarPreview} style={{ width: '50px', borderRadius: '50%', marginTop: '10px' }} />}
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '10px', marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#d32f2f' }}>🔑 管理者パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>保存</button>
          </section>
        )}

      </main>
    </div>
  );
}
