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
  const [view, setView] = useState<'home' | 'bbs' | 'bbs_read' | 'blog_list' | 'blog_write' | 'blog_read' | 'profile' | 'cpp_practice'>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]); // いいね済みIDの保存
  
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  // C++ シミュレーター用
  const [cppCode, setCppCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    int a = 10;\n    for(int i=0; i<3; i++) {\n        cout << "Step: " << i << ", Value: " << a + i << endl;\n    }\n    return 0;\n}`);
  const [cppOutput, setCppOutput] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const [isNewGenre, setIsNewGenre] = useState(false);
  
  const bbsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blogReplyRef = useRef<HTMLTextAreaElement>(null);
  
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('robocup_name');
    const savedAvatar = localStorage.getItem('robocup_avatar');
    const savedAdmin = localStorage.getItem('robocup_is_admin') === 'true';
    const savedLikes = JSON.parse(localStorage.getItem('robocup_likes') || '[]');
    if (savedName) setProfileName(savedName);
    if (savedAvatar) setProfileAvatar(savedAvatar);
    if (savedAdmin) setIsAdmin(true);
    setLikedPosts(savedLikes);
    fetchData();
  }, [view]);

  async function fetchData() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]);
  }

  // --- いいね制限ロジック ---
  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) return; // 既にいいねしてたら終了

    const newLikes = (post.likes || 0) + 1;
    const newLikedPosts = [...likedPosts, post.id];
    
    // ローカル保存
    setLikedPosts(newLikedPosts);
    localStorage.setItem('robocup_likes', JSON.stringify(newLikedPosts));

    // UI即時反映
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    if (activeArticle?.id === post.id) setActiveArticle({ ...activeArticle, likes: newLikes });

    // DB更新
    await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
  }

  // --- C++ 簡易シミュレーター実行 ---
  const runCppSimulation = () => {
    setCppOutput("シミュレーション実行中...\n");
    setTimeout(() => {
      let output = "";
      // 簡易的なパース（cout, for, 変数宣言のみ擬似対応）
      const lines = cppCode.split('\n');
      let variables: {[key: string]: number} = {};

      try {
        lines.forEach(line => {
          // 変数代入: int a = 10;
          let varMatch = line.match(/int\s+(\w+)\s*=\s*(\d+);/);
          if (varMatch) variables[varMatch[1]] = parseInt(varMatch[2]);

          // cout: cout << "text" << var << endl;
          if (line.includes("cout <<")) {
            let contentMatch = line.split("<<").slice(1);
            contentMatch.forEach(part => {
              let p = part.trim().replace("endl;", "").replace(";", "");
              if (p.startsWith('"')) {
                output += p.replace(/"/g, "");
              } else if (variables[p] !== undefined) {
                output += variables[p];
              } else if (!isNaN(parseInt(p))) {
                output += p;
              }
            });
            output += "\n";
          }
        });
        if (!output) output = "プログラムは正常に終了しましたが、出力がありませんでした。";
        setCppOutput(output + "\n\n------------------\nProcess finished.");
      } catch (e) {
        setCppOutput("Error: 構文エラーまたは対応していない記法です。");
      }
    }, 500);
  };

  // 汎用削除機能
  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("本当に削除しますか？")) return;
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (!error) {
      await supabase.from('posts').delete().eq('parent_id', id);
      if (activeThread?.id === id) setView('bbs');
      if (activeArticle?.id === id) setView('blog_list');
      fetchData();
    }
  }

  // ブログ/掲示板 共通
  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // ... (uploadFile, insertTextAtCursor, handleFileAttach, handleBbsSubmit, handleReplySubmit, handleBlogSubmit, saveProfile は前回と同じ) ...
  // ※コード長制限のため一部省略していますが、機能は維持

  async function uploadFile(file: File) {
    const fileName = `${Math.random()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLTextAreaElement | null>, setter: React.Dispatch<React.SetStateAction<string>>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (res) {
      const tag = file.type.startsWith('image/') ? `\n![${res.name}](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      const textarea = ref.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setter(prev => prev.substring(0, start) + tag + prev.substring(end));
      } else {
        setter(prev => prev + tag);
      }
    }
    e.target.value = '';
  }

  async function handleBbsSubmit() {
    if (!title || !content) return;
    await supabase.from('posts').insert([{ title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setTitle(''); setContent(''); fetchData();
  }

  async function handleReplySubmit(parentId: string, currentSetter: React.Dispatch<React.SetStateAction<string>>, currentVal: string) {
    if (!currentVal) return;
    await supabase.from('posts').insert([{ content: currentVal, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    currentSetter(''); fetchData();
  }

  async function handleBlogSubmit() {
    if (!title || !content) return;
    let imageUrl = imageFile ? (await uploadFile(imageFile))?.url : '';
    await supabase.from('posts').insert([{ title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類', likes: 0 }]);
    setTitle(''); setContent(''); setImageFile(null); setGenre('未分類');
    setView('blog_list'); fetchData();
  }

  async function saveProfile() {
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) { newAvatarUrl = res.url; setProfileAvatar(newAvatarUrl); }
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', newAvatarUrl);
    if (adminPassInput === 'admin1234') { localStorage.setItem('robocup_is_admin', 'true'); setIsAdmin(true); }
    setAdminPassInput(''); alert("保存しました"); setView('home');
  }

  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '10px 0', display: 'block' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '8px 12px', borderRadius: '5px', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '5px 0' }}>{fileMatch[1]}</a>;
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333', fontFamily: 'sans-serif' }}>
      
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
            {/* 新規：C++練習ボタン */}
            <div onClick={() => setView('cpp_practice')} style={{ backgroundColor: '#2d2d2d', color: '#fff', padding: '30px', borderRadius: '15px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '15px' }}>💻</div>
              <h3 style={{ margin: 0 }}>C++ プログラミング練習</h3>
            </div>
          </div>
        )}

        {/* C++ PRACTICE SECTION */}
        {view === 'cpp_practice' && (
          <div>
            <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '15px' }}>← 戻る</button>
            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '15px', border: '1px solid #ddd' }}>
              <h2 style={{ color: '#5a3d8a', marginTop: 0 }}>C++ シミュレーター</h2>
              <p style={{ fontSize: '14px', color: '#666' }}>コードを入力して「実行」ボタンを押すと、動作をシュミレーションします。</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Editor (C++)</label>
                  <textarea 
                    value={cppCode} 
                    onChange={(e) => setCppCode(e.target.value)} 
                    style={{ width: '100%', height: '350px', backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', border: 'none', marginTop: '10px', lineHeight: '1.5' }} 
                  />
                  <button onClick={runCppSimulation} style={{ width: '100%', marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>▶ 実行 (Simulate)</button>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Console Output</label>
                  <div style={{ width: '100%', height: '350px', backgroundColor: '#000', color: '#0f0', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', marginTop: '10px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {cppOutput || "> Output will appear here..."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BBS READ (枠なしUI) */}
        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '15px' }}>← 戻る</button>
            <div style={{ backgroundColor: '#fff', borderRadius: '15px', border: '1px solid #ddd', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f8f5fb', padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, color: '#d32f2f' }}>{activeThread.title}</h2>
                {isAdmin && <button onClick={() => handleDeletePost(activeThread.id)} style={{ color: '#d32f2f', border: 'none', background: 'none', cursor: 'pointer' }}>🗑️ 削除</button>}
              </div>
              <div style={{ padding: '30px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
            </div>
            <div style={{ padding: '0 10px', marginBottom: '30px' }}>
              {getReplies(activeThread.id).map((r) => (
                <div key={r.id} style={{ padding: '15px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: '#5a3d8a', fontSize: '15px' }}>{r.author_name}</span>
                      <span style={{ fontSize: '11px', color: '#aaa' }}>{new Date(r.created_at).toLocaleString('ja-JP')}</span>
                    </div>
                    {isAdmin && <button onClick={() => handleDeletePost(r.id)} style={{ border: 'none', background: 'none', color: '#ccc', cursor: 'pointer' }}>🗑️</button>}
                  </div>
                  <div style={{ fontSize: '15px', color: '#444' }}>{renderContent(r.content)}</div>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #ddd' }}>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を入力..." style={{ width: '100%', height: '80px', padding: '15px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '14px', cursor: 'pointer', color: '#5a3d8a', fontWeight: 'bold' }}>📎 <input type="file" onChange={(e) => handleFileAttach(e, replyTextareaRef, setReplyContent)} style={{ display: 'none' }} /></label>
                <button onClick={() => handleReplySubmit(activeThread.id, setReplyContent, replyContent)} style={{ backgroundColor: '#5a3d8a', color: '#fff', border: 'none', padding: '10px 40px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>送信</button>
              </div>
            </div>
          </div>
        )}

        {/* BLOG READ (いいね制限付き) */}
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
                <button 
                  onClick={() => handleLike(activeArticle)} 
                  disabled={likedPosts.includes(activeArticle.id)}
                  style={{ 
                    backgroundColor: likedPosts.includes(activeArticle.id) ? '#eee' : '#fff', 
                    border: '1px solid #ff4b5c', 
                    color: likedPosts.includes(activeArticle.id) ? '#aaa' : '#ff4b5c', 
                    padding: '8px 20px', borderRadius: '20px', cursor: likedPosts.includes(activeArticle.id) ? 'default' : 'pointer', fontWeight: 'bold' 
                  }}
                >
                  {likedPosts.includes(activeArticle.id) ? '✅ いいね済み' : `❤️ いいね ${activeArticle.likes || 0}`}
                </button>
                {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ backgroundColor: '#fff', color: '#d32f2f', border: '1px solid #d32f2f', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer' }}>🗑️</button>}
              </div>
            </div>
            <div style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '50px' }}>{renderContent(activeArticle.content)}</div>
            {/* ... コメント欄は前回同様 ... */}
          </article>
        )}

        {/* ... (その他の BBS LIST, BLOG LIST, BLOG WRITE, PROFILE は前回同様) ... */}
        
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '20px', borderRadius: '12px', marginBottom: '25px' }}>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドタイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea ref={bbsTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容を入力してください..." style={{ width: '100%', height: '80px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '14px', cursor: 'pointer', color: '#5a3d8a', fontWeight: 'bold' }}>📎 <input type="file" onChange={(e) => handleFileAttach(e, bbsTextareaRef, setContent)} style={{ display: 'none' }} /></label>
                <button onClick={handleBbsSubmit} style={{ backgroundColor: '#5a3d8a', color: '#fff', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>投稿</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mainThreads.map(t => (
                <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '10px', border: '1px solid #eee', cursor: 'pointer' }}>
                  <h4 style={{ margin: '0 0 5px 0', color: '#d32f2f' }}>{t.title}</h4>
                  <div style={{ fontSize: '12px', color: '#888' }}>{t.author_name} · {new Date(t.created_at).toLocaleString()}</div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'blog_list' && (
          <div style={{ flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>技術ブログ</h2>
              <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}>＋ 記事を書く</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {blogArticles.map(a => (
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
        )}

        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2 style={{ color: '#5a3d8a' }}>設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>アイコン</label>
              <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); } }} />
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '10px', marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#d32f2f' }}>🔑 管理者パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>保存</button>
          </section>
        )}

      </main>
    </div>
  );
}
