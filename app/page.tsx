"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase設定
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

  // 修正の要：各入力エリアをプログラムから制御するためのref
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
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('images').upload(fileName, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
      return { url: pub.publicUrl, name: file.name };
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  // ★画像挿入ロジックの完全修正★
  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'reply') {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    
    const res = await uploadFile(file);
    if (res) {
      const isImage = file.type.startsWith('image/');
      const tag = isImage ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      
      // ターゲットに応じたステートとRefを選択
      const textarea = target === 'post' ? textareaRef.current : replyTextareaRef.current;
      
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = target === 'post' ? content : replyContent;
        const nextText = currentText.substring(0, start) + tag + currentText.substring(end);
        
        // ステートを更新
        if (target === 'post') setContent(nextText);
        else setReplyContent(nextText);

        // 挿入後にカーソルを移動
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        // 万が一Refが取れなかった場合は末尾に追加
        if (target === 'post') setContent(prev => prev + tag);
        else setReplyContent(prev => prev + tag);
      }
    }
    setLoading(false);
    e.target.value = ''; // 同じファイルを再度選択できるようにリセット
  }

  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) return;
    const newLikedList = [...likedPosts, post.id];
    setLikedPosts(newLikedList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newLikedList));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p));
  }

  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) newAvatarUrl = res.url;
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', newAvatarUrl);
    setProfileAvatar(newAvatarUrl);
    const isNowAdmin = adminPassInput === 'admin1234';
    localStorage.setItem('robocup_is_admin', isNowAdmin ? 'true' : 'false');
    setIsAdmin(isNowAdmin);
    alert("設定を保存しました");
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

  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setReplyContent(''); 
    await fetchData();
    setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) { alert("タイトルと本文を入力してください"); return; }
    setLoading(true);
    await supabase.from('posts').insert([{ title, content, image_url: coverPreview, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類' }]);
    setTitle(''); setContent(''); setCoverPreview(''); setGenre('未分類');
    await fetchData();
    setView('blog_list'); 
    setLoading(false);
  }

  const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '15px 0', display: 'block', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return (
        <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '8px 0', border: '1px solid #ddd' }}>
          📎 {fileMatch[1].replace('📎 ', '')}
        </a>
      );
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '22px', color: '#5a3d8a', cursor: 'pointer', fontWeight: '900' }}>ロボカップ情報共有</h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 15px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      <nav style={{ padding: '12px 40px', display: 'flex', gap: '10px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}><div style={{ fontSize: '50px', marginBottom: '20px' }}>💬</div><h3>交流掲示板</h3></div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}><div style={{ fontSize: '50px', marginBottom: '20px' }}>🖋️</div><h3>技術ブログ</h3></div>
          </div>
        )}

        {/* 掲示板一覧 */}
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '30px', border: '1px solid #e0d5ed' }}>
              <h3 style={{ marginTop: 0 }}>新規スレッド作成</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '6px 15px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 'bold' }}>
                  📸 本文に画像を挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} />
                </label>
              </div>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <button onClick={handleBbsSubmit} disabled={loading} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 35px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>投稿</button>
            </div>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/45'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flexGrow: 1 }}><h4 style={{ margin: 0, color: '#d32f2f' }}>{t.title}</h4><small>{t.author_name} · {new Date(t.created_at).toLocaleString()}</small></div>
                {isAdmin && <button onClick={(e) => handleDeletePost(t.id, e)} style={{ border: 'none', background: 'transparent' }}>🗑️</button>}
              </article>
            ))}
          </div>
        )}

        {/* 掲示板詳細 */}
        {view === 'bbs_read' && activeThread && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <button onClick={() => setView('bbs')} style={{ marginBottom: '20px' }}>← 掲示板に戻る</button>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '20px', border: '1px solid #ddd', marginBottom: '20px' }}>
              <h2 style={{ borderBottom: '2px solid #5a3d8a', paddingBottom: '10px', color: '#5a3d8a' }}>{activeThread.title}</h2>
              <div style={{ marginBottom: '30px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}><span style={{ color: 'green', fontWeight: 'bold' }}>1</span> : <span style={{ fontWeight: 'bold' }}>{activeThread.author_name}</span> : {new Date(activeThread.created_at).toLocaleString()}</div>
                <div style={{ paddingLeft: '15px', fontSize: '17px' }}>{renderContent(activeThread.content)}</div>
              </div>
              {getReplies(activeThread.id).map((r, i) => (
                <div key={r.id} style={{ marginBottom: '25px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}><span style={{ color: 'green', fontWeight: 'bold' }}>{i + 2}</span> : <span style={{ fontWeight: 'bold' }}>{r.author_name}</span> : {new Date(r.created_at).toLocaleString()}</div>
                  <div style={{ paddingLeft: '15px' }}>{renderContent(r.content)}</div>
                </div>
              ))}
            </div>
            {/* 返信フォーム */}
            <div style={{ backgroundColor: '#f3eef7', padding: '30px', borderRadius: '20px', border: '1px solid #e0d5ed' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '8px 15px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 'bold' }}>
                  📸 画像挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'reply')} style={{ display: 'none' }} />
                </label>
              </div>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信内容..." style={{ width: '100%', height: '120px', padding: '15px', borderRadius: '10px', border: '1px solid #ccc', marginBottom: '15px' }} />
              <button onClick={() => handleReplySubmit(activeThread.id)} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', borderRadius: '10px', border: 'none', fontWeight: 'bold', width: '100%' }}>書き込む</button>
            </div>
          </div>
        )}

        {/* ブログ一覧 */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '220px' }}>
              <h3 style={{ borderBottom: '2px solid #5a3d8a', paddingBottom: '10px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li onClick={() => setSelectedGenre(null)} style={{ padding: '10px', cursor: 'pointer', color: !selectedGenre ? '#d32f2f' : '#666', fontWeight: !selectedGenre ? 'bold' : 'normal' }}>すべて表示</li>
                {existingGenres.map(g => <li key={g} onClick={() => setSelectedGenre(g)} style={{ padding: '10px', cursor: 'pointer', color: selectedGenre === g ? '#d32f2f' : '#666' }}>{g}</li>)}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}><h2>技術ブログ</h2><button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '12px 28px', borderRadius: '30px', fontWeight: 'bold' }}>＋ 記事を書く</button></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee' }}>
                    <div style={{ height: '170px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '20px' }}><span style={{ fontSize: '11px', color: '#5a3d8a', fontWeight: 'bold' }}>{a.genre}</span><h4 style={{ margin: '5px 0' }}>{a.title}</h4><small>{a.author_name}</small></div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ブログ詳細・執筆・プロフィールは省略せず全量含めています */}
        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '25px', padding: '40px', border: '1px solid #eee' }}>
            <button onClick={() => setView('blog_list')} style={{ marginBottom: '20px' }}>← 戻る</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '15px', marginBottom: '30px' }} />}
            <h1>{activeArticle.title}</h1>
            <div style={{ fontSize: '18px', lineHeight: '2.0' }}>{renderContent(activeArticle.content)}</div>
            <div style={{ textAlign: 'center', marginTop: '40px' }}><button onClick={() => handleLike(activeArticle)} style={{ padding: '10px 30px', borderRadius: '30px', border: '2px solid #ff4d6d' }}>❤️ {activeArticle.likes || 0}</button></div>
          </article>
        )}

        {view === 'blog_write' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ marginBottom: '20px' }}>← キャンセル</button>
            <div style={{ height: '200px', border: '2px dashed #ddd', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : "🖼️ 表紙画像を選択"}
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const res = await uploadFile(f); if (res) setCoverPreview(res.url); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <div style={{ backgroundColor: '#f3eef7', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
              <label style={{ cursor: 'pointer', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }}>📸 本文に画像を挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} /></label>
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '24px', marginBottom: '20px', padding: '10px', border: 'none', borderBottom: '2px solid #eee' }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', minHeight: '300px', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', borderRadius: '10px', marginTop: '20px', fontWeight: 'bold' }}>公開する</button>
          </div>
        )}

        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <h2 style={{ textAlign: 'center' }}>ユーザー設定</h2>
            <div style={{ marginBottom: '20px' }}><label>表示名</label><input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px' }} /></div>
            <div style={{ marginBottom: '20px' }}><label>アイコン</label><input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} /></div>
            <div style={{ marginBottom: '20px' }}><label>管理者パスワード</label><input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ width: '100%', padding: '10px' }} /></div>
            <button onClick={saveProfile} style={{ width: '100%', padding: '15px', backgroundColor: '#5a3d8a', color: '#fff', borderRadius: '10px', fontWeight: 'bold' }}>保存</button>
          </section>
        )}
      </main>
    </div>
  );
}
