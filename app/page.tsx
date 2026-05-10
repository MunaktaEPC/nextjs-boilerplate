"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseの設定（環境変数を読み込む）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WikiApp() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');

  // 1. データを読み込む機能
  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  // 2. データを保存する機能
  async function handleSubmit() {
    if (!content) return;
    await supabase.from('posts').insert([{ content }]);
    setContent('');
    fetchPosts(); // 再読み込み
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h1>📖 みんなで創る技術Wiki & 掲示板</h1>
      
      {/* 入力エリア */}
      <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "10px", marginBottom: "30px" }}>
        <h3>新しい知恵を残す</h3>
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="後世に残したい技術知識や、みんなへのメッセージを書いてください..."
          style={{ width: "100%", height: "100px", padding: "10px", marginBottom: "10px" }}
        />
        <button onClick={handleSubmit} style={{ padding: "10px 20px", background: "#0070f3", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
          保存して公開する
        </a>
      </div>

      {/* 表示エリア */}
      <div>
        <h3>📜 蓄積された知識一覧</h3>
        {posts.map((post) => (
          <div key={post.id} style={{ borderBottom: "1px solid #eee", padding: "15px 0" }}>
            <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>
            <small style={{ color: "#888" }}>{new Date(post.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
