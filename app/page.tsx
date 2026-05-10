"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseの接続設定
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WikiApp() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');

  // データを読み込む
  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  // データを保存する
  async function handleSubmit() {
    if (!content) return;
    const { error } = await supabase.from('posts').insert([{ content }]);
    if (error) {
      alert("エラー: " + error.message);
    } else {
      setContent('');
      fetchPosts();
    }
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px", fontFamily: "sans-serif", backgroundColor: "#fff", minHeight: "100vh" }}>
      <header style={{ borderBottom: "2px solid #333", marginBottom: "30px", paddingBottom: "10px" }}>
        <h1 style={{ margin: 0 }}>📖 共有知の書：技術Wiki & 掲示板</h1>
        <p style={{ color: "#666" }}>後世に技術を継承するためのオープンな記録場所</p>
      </header>
      
      {/* 入力エリア */}
      <section style={{ background: "#f4f4f4", padding: "20px", borderRadius: "8px", marginBottom: "40px" }}>
        <h3 style={{ marginTop: 0 }}>新しい知識を記録する</h3>
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="ここに入力した内容は、誰でも閲覧・編集可能な知恵として蓄積されます..."
          style={{ width: "100%", height: "120px", padding: "12px", marginBottom: "10px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
        />
        <button 
          onClick={handleSubmit} 
          style={{ padding: "12px 24px", background: "#333", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px" }}
        >
          この知恵を保存する
        </button>
      </section>

      {/* 表示エリア */}
      <section>
        <h3 style={{ borderLeft: "5px solid #333", paddingLeft: "10px" }}>📜 蓄積されたアーカイブ</h3>
        {posts.length === 0 ? (
          <p style={{ color: "#999" }}>まだ記録がありません。最初の知恵を書き込んでください。</p>
        ) : (
          posts.map((post) => (
            <article key={post.id} style={{ borderBottom: "1px solid #eee", padding: "20px 0", animation: "fadeIn 0.5s" }}>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "18px", lineHeight: "1.6", color: "#222" }}>
                {post.content}
              </div>
              <footer style={{ marginTop: "10px" }}>
                <small style={{ color: "#888" }}>記録日時: {new Date(post.created_at).toLocaleString('ja-JP')}</small>
              </footer>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
