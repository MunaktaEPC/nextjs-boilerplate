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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
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

  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadFile(file);
    if (res) {
      const tag = file.type.startsWith('image/') ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + tag + content.substring(end);
        setContent(newContent);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + tag.length, start + tag.length); }, 10);
      } else { setContent(prev => prev + tag); }
    }
    setLoading(false);
  }

  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("この記事を削除してもよろしいですか？")) return;
    setLoading(true);
    await supabase.from('posts').delete().eq('id', id);
    await supabase.from('posts').delete().eq('parent_id', id);
    alert("削除しました");
    if (view === 'bbs_read') setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
    await fetchData();
    setLoading(false);
  }

  async function handleBbsSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setTitle(''); setContent('');
    await fetchData();
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

  const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '10px 0', display: 'block' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return <a key={index} href={fileMatch[2]} target="_blank" style={{ color: '#5a3d8a', fontWeight: 'bold' }}>📎 {fileMatch[1]}</a>;
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#efefef', color: '#000', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #ccc', padding: '10px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '20px', color: '#cc0000', cursor: 'pointer' }}>ロボカップ共有板</h1>
        <div onClick={() => setView('profile')} style={{ cursor: 'pointer', fontSize: '14px' }}>
          ユーザー: <b>{profileName}</b> {isAdmin && '[管理]'}
        </div>
      </header>

      <nav style={{ padding: '5px 40px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ccc', fontSize: '14px' }}>
        <span onClick={() => setView('home')} style={{ cursor: 'pointer', marginRight: '15px' }}>■ホーム</span>
        <span onClick={() => setView('bbs')} style={{ cursor: 'pointer', marginRight: '15px' }}>■掲示板</span>
        <span onClick={() => setView('blog_list')} style={{ cursor: 'pointer' }}>■ブログ</span>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        
        {view === 'home' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc' }}>
            <h3>メニュー</h3>
            <ul>
              <li onClick={() => setView('bbs')} style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}>交流掲示板へ行く</li>
              <li onClick={() => setView('blog_list')} style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}>技術ブログを読む</li>
            </ul>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee' }}>新規スレッド作成</h4>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr><td style={{ width: '80px' }}>タイトル</td><td><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '80%' }} /></td></tr>
                  <tr><td>本文</td><td><textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', height: '100px' }} /></td></tr>
                  <tr><td>画像</td><td><input type="file" onChange={handleFileInsert} /></td></tr>
                  <tr><td></td><td><button onClick={handleBbsSubmit} style={{ padding: '5px 20px' }}>新規スレッドを書き込む</button></td></tr>
                </tbody>
              </table>
            </div>
            {mainThreads.map(t => (
              <div key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer', marginBottom: '10px' }}>
                {t.title} ({getReplies(t.id).length + 1})
              </div>
            ))}
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc' }}>
            <button onClick={() => setView('bbs')} style={{ marginBottom: '20px' }}>掲示板に戻る</button>
            
            <div style={{ borderBottom: '2px solid #efefef', marginBottom: '20px' }}>
              <h2 style={{ color: '#ff0000' }}>{activeThread.title}</h2>
              <div style={{ marginBottom: '15px' }}>
                <span style={{ color: 'green', fontWeight: 'bold' }}>1 : </span>
                <span style={{ color: 'blue' }}>{activeThread.author_name}</span> : 
                {new Date(activeThread.created_at).toLocaleString()} ID:??
                <div style={{ padding: '15px 30px', fontSize: '16px' }}>{renderContent(activeThread.content)}</div>
              </div>

              {getReplies(activeThread.id).map((r, i) => (
                <div key={r.id} style={{ marginBottom: '15px' }}>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>{i + 2} : </span>
                  <span style={{ color: 'blue' }}>{r.author_name}</span> : 
                  {new Date(r.created_at).toLocaleString()} ID:??
                  <div style={{ padding: '10px 30px' }}>{renderContent(r.content)}</div>
                  {isAdmin && <button onClick={() => handleDeletePost(r.id)} style={{ fontSize: '10px' }}>削除</button>}
                </div>
              ))}
            </div>

            {/* 2ch風レス入力欄 */}
            <div style={{ backgroundColor: '#efefef', padding: '15px', border: '1px solid #ccc' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>レスを投稿する</h4>
              <div style={{ marginBottom: '5px' }}>
                名前：<input value={profileName} disabled style={{ backgroundColor: '#ddd' }} />
              </div>
              <textarea 
                value={replyContent} 
                onChange={e => setReplyContent(e.target.value)} 
                style={{ width: '100%', height: '120px', marginBottom: '10px' }}
                placeholder="ここに返信内容を入力"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => handleReplySubmit(activeThread.id)} style={{ padding: '10px 30px', fontWeight: 'bold' }}>書き込む</button>
                {isAdmin && <button onClick={() => handleDeletePost(activeThread.id)} style={{ color: 'red' }}>スレッドごと削除</button>}
              </div>
            </div>
          </div>
        )}

        {/* ... (blog関連のコードは前回のまま維持) ... */}
        {view === 'blog_list' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>技術ブログ</h2>
              <button onClick={() => setView('blog_write')}>記事を書く</button>
            </div>
            {blogArticles.map(a => (
              <div key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ marginBottom: '15px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                <h4 style={{ margin: 0, color: 'blue' }}>{a.title}</h4>
                <small>{a.author_name} - {new Date(a.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <div style={{ backgroundColor: '#fff', padding: '40px', border: '1px solid #ccc' }}>
            <button onClick={() => setView('blog_list')}>←戻る</button>
            <h1>{activeArticle.title}</h1>
            <p>投稿者: {activeArticle.author_name}</p>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%' }} />}
            <div style={{ marginTop: '20px', lineHeight: 1.8 }}>{renderContent(activeArticle.content)}</div>
            {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ marginTop: '20px' }}>記事を削除</button>}
          </div>
        )}

        {view === 'blog_write' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc' }}>
            <h3>ブログ執筆</h3>
            タイトル: <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
            本文: <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', height: '300px' }} />
            <input type="file" onChange={handleFileInsert} />
            <button onClick={async () => {
              await supabase.from('posts').insert([{ title, content, author_name: profileName, category: 'blog', image_url: coverPreview }]);
              setView('blog_list'); fetchData();
            }} style={{ display: 'block', marginTop: '20px', padding: '10px 30px' }}>公開</button>
          </div>
        )}

        {view === 'profile' && (
          <div style={{ backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc' }}>
            <h3>設定</h3>
            名前: <input value={profileName} onChange={e => setProfileName(e.target.value)} /><br /><br />
            パスワード: <input type="password" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} placeholder="admin1234で管理者" /><br /><br />
            <button onClick={() => {
              localStorage.setItem('robocup_name', profileName);
              if (adminPassInput === 'admin1234') { setIsAdmin(true); localStorage.setItem('robocup_is_admin', 'true'); }
              alert("保存しました"); setView('home');
            }}>保存</button>
          </div>
        )}

      </main>
    </div>
  );
}
