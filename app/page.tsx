"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ★ここにアップロードしたロゴのURLを貼り付けてください
const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png";

export default function MunakataThreadBBS() {
  const [view, setView] = useState<'bbs' | 'wiki'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  useEffect(() => { fetchData(); }, [view]);

  async function fetchData() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  async function uploadImage(file: File) {
    const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
    const { data } = await supabase.storage.from('images').upload(fileName, file);
    if (data) {
      const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
      return pub.publicUrl;
    }
    return '';
  }

  async function handleMainSubmit() {
    if (!content) return;
    setLoading(true);
    let imageUrl = imageFile ? await uploadImage(imageFile) : '';
    await supabase.from('posts').insert([{ title, content, image_url: imageUrl }]);
    setTitle(''); setContent(''); setImageFile(null);
    fetchData();
    setLoading(false);
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, 
      parent_id: parentId 
    }]);
    setReplyContent('');
    setReplyTargetId(null);
    fetchData();
    setLoading(false);
  }

  const mainThreads = posts.filter(p => !p.parent_id);
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', color: '#333' }}>
      
      {/* ヘッダー：修正ポイント（position: 'sticky' に直しました） */}
      <header style={{ 
        backgroundColor: '#fff', 
        borderBottom: '4px solid #5a3d8a', 
        padding: '15px 40px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '20px', 
        position: 'sticky', 
        top: 0, 
        zIndex: 100 
      }}>
        <img src={LOGO_URL} alt="Munakata Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
        <div>
          <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '28px', fontWeight: 'bold' }}>MunakataEPC_VLOG</h1>
          <span style={{ fontSize: '14px', color: '#666' }}>〜 公式交流掲示板 〜</span>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={{ padding: '20px 40px', display: 'flex', gap: '15px' }}>
        <button onClick={() => setView('bbs')} style={{ padding: '10px 25px', backgroundColor: view === 'bbs' ? '#5a3d8a' : '#eee', color: view === 'bbs' ? '#fff' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>掲示板</button>
        <button onClick={() => setView('wiki')} style={{ padding: '10px 25px', backgroundColor: view === 'wiki' ? '#5a3d8a' : '#eee', color: view === 'wiki' ? '#fff' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>技術Wiki</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
        {view === 'bbs' ? (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginBottom: '15px', marginTop: 0 }}>🆕 新しい話題（スレッド）を投稿する</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（任意）" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#333' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を書いてください" style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#333' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ fontSize: '14px' }} />
                <button onClick={handleMainSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>スレッドを立てる</button>
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {mainThreads.map(thread => (
                <article key={thread.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ backgroundColor: '#f8f5fb', padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                    <h3 style={{ margin: 0, color: '#b91c1c', fontSize: '20px' }}>{thread.title || '無題のスレッド'}</h3>
                    <small style={{ color: '#888' }}>🕒 {new Date(thread.created_at).toLocaleString('ja-JP')}</small>
                  </div>

                  <div style={{ padding: '20px' }}>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0, color: '#333' }}>{thread.content}</p>
                    {thread.image_url && <img src={thread.image_url} alt="Thread image" style={{ maxWidth: '100%', maxHeight: '400px', marginTop: '15px', borderRadius: '8px', display: 'block' }} />}
                    
                    <button 
                      onClick={() => setReplyTargetId(replyTargetId === thread.id ? null : thread.id)}
                      style={{ marginTop: '15px', background: 'none', border: '1px solid #5a3d8a', color: '#5a3d8a', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' }}
                    >
                      💬 返信する
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#fafafa', borderTop: '1px solid #eee' }}>
                    {getReplies(thread.id).map((reply, index) => (
                      <div key={reply.id} style={{ padding: '15px 20px 15px 40px', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '20px', top: '0', bottom: '0', width: '2px', backgroundColor: '#dcd0ea' }}></div>
                        <div style={{ fontSize: '13px', color: '#777', marginBottom: '5px' }}>{index + 1}: 名無しさん - {new Date(reply.created_at).toLocaleString('ja-JP')}</div>
                        <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', color: '#333' }}>{reply.content}</p>
                      </div>
                    ))}

                    {replyTargetId === thread.id && (
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderTop: '2px solid #5a3d8a' }}>
                        <textarea 
                          value={replyContent} 
                          onChange={(e) => setReplyContent(e.target.value)} 
                          placeholder="返信内容を入力..." 
                          style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', marginBottom: '10px', color: '#333' }} 
                        />
                        <div style={{ textAlign: 'right' }}>
                          <button onClick={() => handleReplySubmit(thread.id)} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>書き込む</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px', color: '#888' }}>Wiki画面は準備中です</div>
        )}
      </main>
    </div>
  );
}
