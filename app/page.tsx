"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png"; // 以前のロゴURLを貼ってください

export default function MunakataBlog() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [view, setView] = useState<'bbs' | 'wiki' | 'profile'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 入力用
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // プロフィール編集用
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  useEffect(() => {
    // ログイン状態の監視
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    fetchData();
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setEditName(data.full_name || '');
      setEditAvatar(data.avatar_url || '');
    }
  }

  async function fetchData() {
    // 投稿とプロフィールを結合して取得
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(full_name, avatar_url)')
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  async function updateProfile() {
    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: editName,
      avatar_url: editAvatar,
      updated_at: new Date(),
    });
    if (!error) {
      alert("プロフィールを更新しました！");
      fetchProfile(session.user.id);
      fetchData();
    }
    setLoading(false);
  }

  async function handleMainSubmit() {
    if (!session) return alert("ログインが必要です");
    if (!content) return;
    setLoading(true);
    let imageUrl = '';
    if (imageFile) {
      const fileName = `${Math.random()}.${imageFile.name.split('.').pop()}`;
      const { data } = await supabase.storage.from('images').upload(fileName, imageFile);
      if (data) {
        const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
        imageUrl = pub.publicUrl;
      }
    }
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, user_id: session.user.id 
    }]);
    setTitle(''); setContent(''); setImageFile(null);
    fetchData();
    setLoading(false);
  }

  async function handleReplySubmit(parentId: string) {
    if (!session) return alert("ログインが必要です");
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: parentId, user_id: session.user.id 
    }]);
    setReplyContent(''); setReplyTargetId(null);
    fetchData();
    setLoading(false);
  }

  const mainThreads = posts.filter(p => !p.parent_id);
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

  // ログインしていない場合の簡易表示
  if (!session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
        <h1>MunakataEPC_BLOG</h1>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'github' })} style={{ padding: '15px 30px', fontSize: '18px', cursor: 'pointer' }}>
          GitHubでログインして参加する
        </button>
        <p style={{ color: '#888' }}>※Vercel環境にログインしている必要があります</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', color: '#333' }}>
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={LOGO_URL} alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
          <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '24px' }}>MunakataEPC_BLOG</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span onClick={() => setView('profile')} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            {profile?.full_name || 'ゲスト'} さん
          </span>
          <button onClick={() => supabase.auth.signOut()} style={{ background: '#eee', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>ログアウト</button>
        </div>
      </header>

      <nav style={{ padding: '20px 40px', display: 'flex', gap: '15px' }}>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', backgroundColor: view === 'bbs' ? '#5a3d8a' : '#eee', color: view === 'bbs' ? '#fff' : '#333', cursor: 'pointer' }}>掲示板</button>
        <button onClick={() => setView('wiki')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', backgroundColor: view === 'wiki' ? '#5a3d8a' : '#eee', color: view === 'wiki' ? '#fff' : '#333', cursor: 'pointer' }}>Wiki</button>
        <button onClick={() => setView('profile')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', backgroundColor: view === 'profile' ? '#5a3d8a' : '#eee', color: view === 'profile' ? '#fff' : '#333', cursor: 'pointer' }}>設定</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
        {view === 'profile' ? (
          <section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2>プロフィール設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label>表示名</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label>アイコンURL</label>
              <input type="text" value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
            </div>
            <button onClick={updateProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>保存する</button>
          </section>
        ) : (
          <div>
            {/* 投稿フォームと一覧（前回のロジックを維持しつつ、投稿者にプロフィールを反映） */}
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a' }}>🆕 BLOG記事（スレッド）を書く</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <button onClick={handleMainSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>投稿</button>
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {mainThreads.map(thread => (
                <article key={thread.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f8f5fb', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={thread.profiles?.avatar_url || 'https://via.placeholder.com/40'} style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                      <span style={{ fontWeight: 'bold' }}>{thread.profiles?.full_name || '名無し'}</span>
                      <h3 style={{ margin: 0, color: '#b91c1c', fontSize: '18px' }}>{thread.title}</h3>
                    </div>
                    <small>{new Date(thread.created_at).toLocaleString()}</small>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{thread.content}</p>
                    {thread.image_url && <img src={thread.image_url} style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '8px' }} />}
                    <button onClick={() => setReplyTargetId(replyTargetId === thread.id ? null : thread.id)} style={{ marginTop: '10px', color: '#5a3d8a', background: 'none', border: 'none', cursor: 'pointer' }}>返信する</button>
                  </div>
                  {/* 返信部分も同様にプロフィールを表示 */}
                  <div style={{ backgroundColor: '#fafafa' }}>
                    {getReplies(thread.id).map(reply => (
                      <div key={reply.id} style={{ padding: '10px 20px 10px 40px', borderTop: '1px solid #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#666' }}>
                          <img src={reply.profiles?.avatar_url || 'https://via.placeholder.com/40'} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                          <strong>{reply.profiles?.full_name || '名無し'}</strong>
                        </div>
                        <p style={{ margin: '5px 0' }}>{reply.content}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
