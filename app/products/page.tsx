'use client';

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** ===== 공통 타입 ===== */
type RsData<T> = { resultCode: string; msg: string; data: T };

/** ===== 커피 DTO ===== */
type CoffeeResponseDto = {
  coffeeId: number;
  name: string;
  price: number;
  contents?: string;
  imageUrl?: string;
};

const formatKRW = (n: number) =>
  (n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '원';

export default function AdminProductsPage() {
  const router = useRouter();

  const [list, setList] = useState<CoffeeResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({}); // coffeeId -> opened

  /** 상품 목록 불러오기 */
  const fetchProducts = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 관리자 토큰이 필요한 경우를 대비해 헤더에 붙임(백엔드에서 필요 없으면 무시)
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

      const res = await fetch('/api/coffee/products', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.replace('/admin/login');
          return;
        }
        setErr('상품 목록을 불러오지 못했습니다.');
        return;
      }

      const json = await res.json();
      const data: CoffeeResponseDto[] = (json?.data ?? json) as CoffeeResponseDto[];
      setList(Array.isArray(data) ? data : []);
    } catch {
      setErr('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  /** 검색 필터(이름/내용/ID) */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.name, p.contents, String(p.coffeeId)]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [list, query]);

  /** 로그아웃 */
  const logout = () => {
    localStorage.removeItem('adminToken');
    router.replace('/admin/login');
  };

  /** 펼침 제어 */
  const toggleOne = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () =>
    setExpanded(Object.fromEntries(filtered.map((p) => [p.coffeeId, true])));
  const collapseAll = () => setExpanded({});

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 헤더: 제목 + 우측 액션 */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">제품 관리</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/order"
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              주문 관리
            </Link>
            <button
              onClick={logout}
              className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm hover:opacity-90"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 검색 + 펼치기/접기/새로고침 */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품명/내용/ID 검색…"
            className="w-full sm:w-80 rounded-md border bg-white px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              모두 접기
            </button>
            <button
              onClick={fetchProducts}
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 상태 */}
        {loading && (
          <div className="rounded-md bg-white p-6 shadow text-sm text-gray-500">
            로딩 중…
          </div>
        )}
        {err && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* 표 */}
        {!loading && !err && (
          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-3 text-left w-24">상세</th>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">이미지</th>
                  <th className="px-4 py-3 text-left">상품명</th>
                  <th className="px-4 py-3 text-right">가격</th>
                  <th className="px-4 py-3 text-left">내용(요약)</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      등록된 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const isOpen = !!expanded[p.coffeeId];
                    const detailsId = `product-${p.coffeeId}-details`;
                    return (
                      <Fragment key={p.coffeeId}>
                        <tr className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleOne(p.coffeeId)}
                              className="bg-white px-2 py-1 text-xs hover:bg-gray-50 rounded"
                              aria-expanded={isOpen}
                              aria-controls={detailsId}
                            >
                              {isOpen ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium">#{p.coffeeId}</td>
                          <td className="px-4 py-3">
                            <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                                  IMG
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">{p.name}</td>
                          <td className="px-4 py-3 text-right">{formatKRW(p.price)}</td>
                          <td className="px-4 py-3">
                            <div className="line-clamp-1 text-gray-600">
                              {p.contents || '—'}
                            </div>
                          </td>
                        </tr>

                        {/* 상세영역 */}
                        {isOpen && (
                          <tr id={detailsId} className="border-t bg-gray-50/60">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid grid-cols-5 gap-4">
                                {/* 큰 이미지 */}
                                <div className="col-span-2">
                                  <div className="aspect-square w-full rounded-xl bg-gray-100 overflow-hidden">
                                    {p.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                        NO IMAGE
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* 상세 텍스트 */}
                                <div className="col-span-3">
                                  <div className="text-base font-semibold">{p.name}</div>
                                  <div className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                                    {p.contents || '설명 정보가 없습니다.'}
                                  </div>
                                  <div className="mt-3 text-sm text-gray-900 font-medium">
                                    {formatKRW(p.price)}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 하단 요약 */}
        {!loading && !err && (
          <div className="mt-4 text-sm text-gray-600">
            총 <b>{filtered.length}</b>건 표시
          </div>
        )}
      </div>
    </main>
  );
}
