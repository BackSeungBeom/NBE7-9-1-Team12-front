'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type RsData<T> = { resultCode: string; msg: string; data: T };
type LoginSuccess = { token?: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!username.trim() || !password) {
      setErr('아이디와 비밀번호를 모두 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ username: username.trim(), password }),
      });

      let ok = res.ok;
      let token: string | undefined;

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const asRs = json as Partial<RsData<LoginSuccess>>;
        if (asRs?.resultCode?.startsWith?.('200')) ok = true;
        token =
          (asRs?.data as LoginSuccess | undefined)?.token ??
          (json?.token as string | undefined);
      } catch {
        // JSON이 아니면 res.ok 기준
      }

      if (!ok) {
        setErr('로그인에 실패했습니다. 아이디/비밀번호를 확인해주세요.');
        return;
      }

      if (token) localStorage.setItem('adminToken', token);

      router.replace('/admin/order');
    } catch {
      setErr('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* app/page.tsx와 동일한 컨테이너/우측정렬 버튼 */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex justify-end mb-4">
          <Link
            href="/"
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm hover:opacity-90 active:scale-[0.99] transition"
          >
            메인 페이지
          </Link>
        </div>

        {/* 로그인 카드 센터 정렬 */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow p-8">
              <h1 className="text-xl font-semibold text-center">관리자 로그인</h1>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm mb-1">아이디</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="아이디"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">비밀번호</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
                      placeholder="비밀번호"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="shrink-0 rounded-md border px-2 py-2 text-xs hover:bg-gray-50"
                      aria-label="비밀번호 보기 전환"
                    >
                      {showPw ? '숨기기' : '보기'}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-gray-900 text-white py-2 text-sm hover:opacity-90 disabled:opacity-40 active:scale-[0.99] transition"
                >
                  {loading ? '로그인 중…' : '로그인'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
