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
  stock?: number;
};

const formatKRW = (n: number) =>
  (n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '원';

/** 파일명이면 /images/<파일명> 으로 보정 */
const resolveImage = (raw?: string) => {
  if (!raw) return undefined;
  if (raw.startsWith('http') || raw.startsWith('/images/')) return raw;
  return `/images/${raw}`;
};

/** ====== 추가 폼 모달 (이미지 파일 업로드) ====== */
function AddProductModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void; // 저장 후 목록 갱신
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(''); // 문자열로 받아서 검증
  const [contents, setContents] = useState('');
  const [stock, setStock] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 미리보기 URL
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (open) {
      setName('');
      setPrice('');
      setContents('');
      setStock('');
      setFile(null);
      setErr(null);
      setSubmitting(false);
    }
  }, [open]);

  // AddProductModal 내부
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (submitting) return;

  const nameTrim = name.trim();
  const contentsTrim = contents.trim();
  const priceNum = Number.parseInt(price.trim(), 10);
  const stockNum = Number.parseInt(stock.trim(), 10);

  if (!nameTrim) return setErr('상품명은 필수입니다.');
  if (!Number.isFinite(priceNum) || priceNum < 0) return setErr('가격은 0 이상 숫자여야 합니다.');
  if (!contentsTrim) return setErr('상품 설명은 필수입니다.');
  if (!Number.isFinite(stockNum) || stockNum < 0) return setErr('재고는 0 이상 숫자여야 합니다.');
  if (!file) return setErr('이미지 파일을 선택해주세요.');

  setErr(null);
  setSubmitting(true);

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

    // 1) 이미지 먼저 업로드 (multipart/form-data)
    const fd = new FormData();
    fd.append('file', file); // ← MediaController @RequestPart("file")

    const upRes = await fetch('/api/coffee/products/image', {
      method: 'POST',
      body: fd,                      // Content-Type 직접 세팅 금지!
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!upRes.ok) {
      const t = await upRes.text();
      console.error('image upload failed', upRes.status, t);
      setErr('이미지 업로드에 실패했습니다.');
      return;
    }

    const upJson = await upRes.json();
    // RsData 또는 평문 응답 모두 지원
    const imageUrl: string =
      upJson?.data?.imageUrl ?? upJson?.imageUrl;
    if (!imageUrl) {
      setErr('이미지 업로드 결과가 올바르지 않습니다.');
      return;
    }

    // 2) 상품 등록 (application/json)
    const addRes = await fetch('/api/coffee/products/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: nameTrim,
        price: priceNum,
        contents: contentsTrim,
        imageUrl,           // ← 업로드 결과로 받은 URL (/images/파일명)
        stock: stockNum,
      }),
    });

    if (!addRes.ok) {
      const t = await addRes.text();
      console.error('add product failed', addRes.status, t);
      setErr('등록에 실패했습니다.');
      return;
    }

    await onSaved(); // 목록 갱신
    onClose();
  } catch (e) {
    console.error(e);
    setErr('요청 중 오류가 발생했습니다.');
  } finally {
    setSubmitting(false);
  }
};


  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-[720px] max-w-[92vw] bg-white rounded-2xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold">새 상품 추가</h3>
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-4">
          {/* 이미지 미리보기 */}
          <div className="col-span-2">
            <div className="aspect-square w-full rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">이미지 미리보기</span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              업로드한 이미지는 <code>src/main/resources/static/images</code>에 저장되고,
              <code>/images/파일명</code> URL로 제공됩니다.
            </p>
          </div>

          {/* 폼 필드 */}
          <div className="col-span-3 space-y-3">
            <div>
              <label className="block text-sm mb-1">상품명</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">가격(원)</label>
                <input
                  inputMode="numeric"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="예: 7000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">재고</label>
                <input
                  inputMode="numeric"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={stock}
                  onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="예: 100"
                  required
                />
              </div>
            </div>

            <div>
  <label className="block text-sm mb-1">이미지 파일</label>

  <div className="flex items-center gap-2">
    {/* 실제 파일 입력은 숨기고 */}
    <input
      id="add-image"
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      required
    />

    {/* 사용자가 보는 ‘파일 추가’ 링크 스타일 버튼 */}
    <label
      htmlFor="add-image"
      className="inline-flex items-center gap-1 text-blue-600 hover:underline cursor-pointer select-none
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
      title="이미지 선택"
    >
      {/* 업로드 아이콘 (SVG) */}
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      파일 추가
    </label>

    {/* 선택된 파일명 & 지우기 */}
    {file && (
      <>
        <span className="text-xs text-gray-600">{file.name}</span>
        <button
          type="button"
          onClick={() => setFile(null)}
          className="text-xs text-gray-500 hover:underline"
        >
          지우기
        </button>
      </>
    )}
  </div>

  <p className="mt-1 text-[11px] text-gray-500">
    JPG/PNG 등 이미지 파일을 업로드하세요.
  </p>
</div>

            <div>
              <label className="block text-sm mb-1">설명</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-24"
                value={contents}
                onChange={(e) => setContents(e.target.value)}
                placeholder="상품 설명을 입력하세요."
                required
              />
            </div>

            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {err}
              </div>
            )}

            <div className="pt-1 flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-40"
              >
                {submitting ? '등록 중…' : '등록'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/** ====== 페이지 ====== */
export default function AdminProductsPage() {
  const router = useRouter();

  const [list, setList] = useState<CoffeeResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);

  /** 상품 목록 불러오기 */
  const fetchProducts = async () => {
    setLoading(true);
    setErr(null);
    try {
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
      const fixed = (Array.isArray(data) ? data : []).map((p) => ({
        ...p,
        imageUrl: resolveImage(p.imageUrl),
      }));
      setList(fixed);
    } catch {
      setErr('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  /** 검색 필터 */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.name, p.contents, String(p.coffeeId)]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q)),
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
        {/* 헤더 */}
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

        {/* 검색 + 펼치기/접기/추가하기 */}
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
              onClick={() => setAddOpen(true)}
              className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm hover:opacity-90"
              title="새 상품 추가"
            >
              추가하기
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
                  <th className="px-4 py-3 text-center">재고</th>
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
                          <td className="px-4 py-3 text-center">{p.stock}</td>
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

      {/* 추가 모달 */}
      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={fetchProducts}
      />
    </main>
  );
}
