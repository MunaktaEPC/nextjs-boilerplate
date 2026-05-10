"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TechPortal() {
  const [view, setView] = useState<'bbs' | 'wiki'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
  const [wikis, setWikis] = useState<any[]>([]);
  
  // 掲示板入力用
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null); // 返信先
  const [loading, setLoading] = useState(false);

  // Wiki入力用
  const [wikiTitle, setWikiTitle] = useState('');
  const [wikiBody, setWikiBody] = useState('');

  useEffect(() => { fetchData(); }, [view]);

  async function fetchData() {
    if (view === 'bbs') {
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (data) setPosts(data);
    } else {
      const { data } = await supabase.from('wiki_pages').select('*').order('created_at', { ascending: false });
      if (data) setWikis(data);
    }
  }

  // 掲示板投稿（画像アップロード込み）
  async function handleBbsSubmit() {
    if (!content) return;
    setLoading(true);
    let imageUrl = '';

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('images').upload(fileName, imageFile);
      if (data) {
        const { data: publicUrl } = supabase.storage.from('images').getPublicUrl(fileName);
        imageUrl = publicUrl.publicUrl;
      }
    }

    await supabase.from('posts').insert([{ 
      title: title || (replyTo ? `Re: ${replyTo.title || '投稿'}` : ''), 
      content, 
      image_url: imageUrl,
      parent_id: replyTo?.id || null 
    }]);

    setTitle(''); setContent(''); setImageFile(null); setReplyTo(null);
    fetchData();
    setLoading(false);
  }

  // Wiki投稿
  async function handleWikiSubmit() {
    if (!wikiTitle || !wikiBody) return;
    await supabase.from('wiki_pages').insert([{ title: wikiTitle, body: wikiBody }]);
    setWikiTitle(''); setWikiBody('');
    fetchData();
  }

  // 投稿のツリー表示用フィルタ
  const mainPosts = posts.filter(p => !p.parent_id);
  const getReplies = (id: string) => posts.filter(p => p.parent_id === id).reverse();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', color: '#1a1a1a', fontFamily: 'sans-serif' }}>
      <nav style={{ backgroundColor: '#1a1a1a', color: 'white', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ margin: 0, fontSize: '22px' }}>🎥 MunakataEPC_VLOG</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setView('bbs')} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: view === 'bbs' ? '#0070f3' : '#333', color: 'white', cursor: 'pointer' }}>掲示板</button>
          <button onClick={() => setView('wiki')} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: view === 'wiki' ? '#0070f3' : '#333', color: 'white', cursor: 'pointer' }}>Wiki</button>
        </div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {view === 'bbs' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '40px', alignItems: 'flex-start' }}>
            {/* 投稿フォーム */}
            <aside style={{ backgroundColor: 'white', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', position: 'sticky', top: '100px' }}>
              <h3>{replyTo ? `返信中: ${replyTo.content.substring(0,10)}...` : '🆕 新規投稿'}</h3>
              {replyTo && <button onClick={() => setReplyTo(null)} style={{ fontSize: '12px', marginBottom: '10px' }}>キャンセル</button>}
              
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（任意）" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容を入力..." style={{ width: '100%', height: '120px', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ marginBottom: '15px', fontSize: '14px' }} />
              
              <button onClick={handleBbsSubmit} disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                {loading ? '処理中...' : '投稿する'}
              </button>
            </aside>

            {/* タイムライン */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {mainPosts.map(post => (
                <div key={post.id} style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', border: '1px solid #eee' }}>
                  {post.title && <h4 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>{post.title}</h4>}
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: '17px' }}>{post.content}</p>
                  {post.image_url && <img src={post.image_url} alt="upload" style={{ maxWidth: '100%', borderRadius: '10px', marginTop: '10px' }} />}
                  <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small style={{ color: '#888' }}>{new Date(post.created_at).toLocaleString()}</small>
                    <button onClick={() => { setReplyTo(post); window.scrollTo(0,0); }} style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer' }}>返信する</button>
                  </div>

                  {/* 返信一覧 */}
                  {getReplies(post.id).map(reply => (
                    <div key={reply.id} style={{ marginLeft: '40px', marginTop: '15px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '10px', borderLeft: '4px solid #0070f3' }}>
                      <p style={{ margin: 0, fontSize: '15px' }}>{reply.content}</p>
                      {reply.image_url && <img src={reply.image_url} style={{ maxWidth: '150px', marginTop: '10px' }} />}
                      <small style={{ color: '#888' }}>{new Date(reply.created_at).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Wikiビュー（省略せず機能維持） */
          <div>
            <section style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', marginBottom: '30px' }}>
              <h3>📚 Wiki作成</h3>
              <input type="text" value={wikiTitle} onChange={(e) => setWikiTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <textarea value={wikiBody} onChange={(e) => setWikiBody(e.target.value)} placeholder="本文" style={{ width: '100%', height: '200px', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <button onClick={handleWikiSubmit} style={{ padding: '12px 30px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Wiki保存</button>
            </section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {wikis.map(w => (
                <div key={w.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <h4>{w.title}</h4>
                  <p style={{ fontSize: '14px', color: '#555' }}>{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
