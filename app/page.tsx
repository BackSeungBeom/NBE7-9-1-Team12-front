'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

/** ===== 공통 타입 ===== */
type RsData<T> = { resultCode: string; msg: string; data: T };
type NewCartResBody = { cartId: number };
type ItemLine = {
  itemId: number;
  productId: number;
  name: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};
type SummaryRes = { items: ItemLine[]; totalAmount: number };

/** 커피 DTO(목록/상세 공통) */
type CoffeeResponseDto = {
  coffeeId: number;
  name: string;
  price: number;
  contents?: string;
  imageUrl?: string; // ← 파일명 또는 절대경로가 올 수 있음
};

/** 결제 시 고객 정보(백엔드 PaymentRequest와 동일) */
type PaymentRequest = {
  customerEmail: string;
  address: string;
  zipcode: string;
};

/** 화면 상품 타입 */
type Product = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
  contents?: string;
};

const formatKRW = (n: number) => (n ?? 0).toLocaleString('ko-KR') + '원';

/** 이미지 경로 정규화: 파일명이면 /images/<파일명> 로, 절대/상대경로면 그대로 */
const resolveImage = (raw?: string) => {
  if (!raw) return undefined;
  if (raw.startsWith('http') || raw.startsWith('/images/')) return raw;
  return `/images/${raw}`;
};

/** ===== 상세 모달 ===== */
function DetailModal({
  open,
  onClose,
  loading,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  data: CoffeeResponseDto | null;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-[680px] max-w-[92vw] bg-white rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold">상품 내용</h3>
          <button
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-gray-500">불러오는 중…</div>
        ) : !data ? (
          <div className="p-8 text-sm text-red-500">상품 정보를 불러오지 못했습니다.</div>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {/* 이미지 */}
            <div className="col-span-2">
              <div className="aspect-square w-full rounded-xl bg-gray-100 overflow-hidden">
                {resolveImage(data.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImage(data.imageUrl)}
                    alt={data.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    IMG
                  </div>
                )}
              </div>
            </div>
            {/* 텍스트 */}
            <div className="col-span-3">
              <div className="text-base font-semibold">{data.name}</div>
              <div className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                {data.contents || '설명 정보가 없습니다.'}
              </div>
              <div className="mt-3 text-sm text-gray-900 font-medium">
                {formatKRW(data.price)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ===== 메인 페이지 ===== */
export default function Page() {
  const [cartId, setCartId] = useState<number | null>(null);
  const [summary, setSummary] = useState<SummaryRes>({ items: [], totalAmount: 0 });
  const [products, setProducts] = useState<Product[]>([]);

  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState('');
  const [zip, setZip] = useState('');

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CoffeeResponseDto | null>(null);

  /** ===== 카트 보장: 필요 시에만 생성 (lazy-create) ===== */
  const ensureCartId = async (): Promise<number> => {
    if (cartId != null) return cartId;
    const res = await fetch('/api/coffee/carts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`createCart failed: ${res.status}`);
    const data: RsData<NewCartResBody> = await res.json();
    const newId = data.data.cartId;
    localStorage.setItem('cartId', String(newId));
    setCartId(newId);
    return newId;
  };

  /** ===== 상품 목록 로딩 ===== */
  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/coffee/products', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('get products failed', res.status, await res.text());
        return;
      }
      const data: RsData<CoffeeResponseDto[]> = await res.json();
      setProducts(
        (data.data ?? []).map((d) => ({
          id: d.coffeeId,
          name: d.name,
          price: d.price,
          imageUrl: resolveImage(d.imageUrl), // ★ 여기에서 정규화
          contents: d.contents,
        })),
      );
    } catch (e) {
      console.error('get products network error', e);
    }
  };

  /** ===== 장바구니 요약 ===== */
  const fetchSummary = async (id: number) => {
    try {
      const res = await fetch(`/api/coffee/carts/${id}/summary?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('get summary failed', res.status, await res.text());
        return;
      }
      const data: RsData<SummaryRes> = await res.json();
      setSummary(data.data);
    } catch (e) {
      console.error('summary network error', e);
    }
  };

  /** 초기: 상품만 불러오고, 기존 cartId 있으면 복구 */
  useEffect(() => {
    fetchProducts();
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cartId') : null;
    if (saved) setCartId(Number(saved));
  }, []);
  useEffect(() => {
    if (cartId != null) fetchSummary(cartId);
  }, [cartId]);

  /** 유틸: 카트 포함 여부 */
  const isInCart = (productId: number) =>
    summary.items.some((it) => it.productId === productId);

  /** 체크박스 토글로 추가/삭제 (추가 시에만 카트 생성) */
  const onToggleProduct = async (productId: number, nextChecked: boolean) => {
    if (togglingId !== null) return;
    setTogglingId(productId);
    try {
      if (nextChecked) {
        const id = await ensureCartId();
        if (!isInCart(productId)) {
          const res = await fetch('/api/coffee/carts/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartId: id, productId }),
          });
          if (!res.ok) {
            console.error('addCartItem failed', res.status, await res.text());
            return;
          }
        }
        await fetchSummary(id);
      } else {
        if (cartId == null || !isInCart(productId)) return;
        const ok = window.confirm('상품을 삭제하시겠습니까?');
        if (!ok) return;
        const res = await fetch(`/api/coffee/carts/${cartId}/items/${productId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          console.error('remove failed', res.status, await res.text());
          return;
        }
        await fetchSummary(cartId);
      }
    } catch (e) {
      console.error('toggle product error', e);
    } finally {
      setTogglingId(null);
    }
  };

  /** 수량 증감 */
  const increaseQty = async (productId: number) => {
    if (cartId == null || mutatingId !== null) return;
    setMutatingId(productId);
    try {
      const res = await fetch(`/api/coffee/carts/${cartId}/items/${productId}/increase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        console.error('increase failed', res.status, await res.text());
        return;
      }
      await fetchSummary(cartId);
    } catch (e) {
      console.error('increase network error', e);
    } finally {
      setMutatingId(null);
    }
  };
  const decreaseQty = async (productId: number) => {
    if (cartId == null || mutatingId !== null) return;
    setMutatingId(productId);
    try {
      const res = await fetch(`/api/coffee/carts/${cartId}/items/${productId}/decrease`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        console.error('decrease failed', res.status, await res.text());
        return;
      }
      await fetchSummary(cartId);
    } catch (e) {
      console.error('decrease network error', e);
    } finally {
      setMutatingId(null);
    }
  };

  /** 상세 모달 */
  const openDetail = async (coffeeId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/coffee/${coffeeId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('getCoffee failed', res.status, await res.text());
        setDetail(null);
        return;
      }
      const body: RsData<CoffeeResponseDto> = await res.json();
      const dto = body.data;
      setDetail({ ...dto, imageUrl: resolveImage(dto.imageUrl) }); // ★ 상세도 정규화
    } catch (e) {
      console.error('getCoffee network error', e);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /** 결제 (버튼은 항상 활성화 → 내부에서 검증 후 alert) */
  const totalCount = useMemo(
    () => summary.items.reduce((s, i) => s + i.qty, 0),
    [summary.items],
  );

  const resetAfterPay = () => {
    localStorage.removeItem('cartId'); // 다음에 필요할 때 새로 발급
    setCartId(null);
    setSummary({ items: [], totalAmount: 0 });
    setEmail('');
    setAddr('');
    setZip('');
  };

  const onPay = async () => {
    if (paying) return;

    // 간단 검증
    if (summary.items.length === 0) {
      alert('장바구니가 비어 있습니다. 상품을 추가해주세요.');
      return;
    }
    const emailTrimmed = email.trim();
    const addrTrimmed = addr.trim();
    const zipTrimmed = zip.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      alert('이메일 형식이 올바르지 않습니다.');
      return;
    }
    if (!addrTrimmed) {
      alert('주소를 입력하세요.');
      return;
    }
    if (!/^\d{5}$/.test(zipTrimmed)) {
      alert('우편번호는 5자리 숫자입니다.');
      return;
    }

    // cartId 보장
    let id = cartId;
    try {
      id = await ensureCartId();
    } catch {
      alert('장바구니 생성에 실패했습니다.');
      return;
    }

    alert(
      `결제 요청
- 품목: ${summary.items.length}개 (${totalCount}개)
- 총금액: ${(summary.totalAmount ?? 0).toLocaleString('ko-KR')}원
- 이메일: ${emailTrimmed}
- 주소: ${addrTrimmed}
- 우편번호: ${zipTrimmed}`,
    );

    setPaying(true);
    try {
      // 이메일 저장(유지)
      try {
        const resEmail = await fetch(`/api/coffee/carts/${id}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
          body: emailTrimmed,
        });
        if (!resEmail.ok)
          console.warn('setOwnerEmail failed', resEmail.status, await resEmail.text());
      } catch (e) {
        console.warn('setOwnerEmail network error', e);
      }

      // 주문 시간 저장(선택)
      try {
        const iso = new Date().toISOString();
        const resDate = await fetch(`/api/coffee/carts/${id}/date`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
          body: iso,
        });
        if (!resDate.ok) console.warn('setOrderDate failed (optional)', resDate.status);
      } catch {
        /* optional */
      }

      // 고객 저장(추가)
      const payload: PaymentRequest = {
        customerEmail: emailTrimmed,
        address: addrTrimmed,
        zipcode: zipTrimmed,
      };
      const resCustomer = await fetch(`/api/coffee/carts/${id}/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resCustomer.ok) {
        console.error('createCustomer failed', resCustomer.status, await resCustomer.text());
        alert('고객 정보 저장에 실패했습니다.');
        return;
      }

      // 성공 → 초기화
      resetAfterPay();
    } catch (e) {
      console.error('pay flow error', e);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setPaying(false);
    }
  };

  /** ===== UI ===== */
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* 관리자 로그인 */}
        <div className="flex justify-end mb-4">
          <Link
            href="/admin/login"
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm hover:opacity-90 active:scale-[0.99] transition"
          >
            관리자 로그인
          </Link>
        </div>

        <h1 className="text-center text-3xl font-semibold mb-8">Grids &amp; Circle</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 상품 목록 */}
          <section className="md:col-span-2 bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-semibold mb-4">상품 목록</h2>

            <div className="divide-y">
              {products.length === 0 ? (
                <div className="py-6 text-sm text-gray-500">
                  상품을 불러오는 중이거나, 등록된 상품이 없습니다.
                </div>
              ) : (
                products.map((p) => {
                  const checked = isInCart(p.id);
                  const disabled = togglingId === p.id;
                  return (
                    <div key={p.id} className="py-4 flex items-center justify-between">
                      {/* 상세 모달 */}
                      <button
                        type="button"
                        onClick={() => openDetail(p.id)}
                        className="flex items-center gap-4 text-left"
                        aria-label={`${p.name} 상세보기`}
                      >
                        <div className="w-12 h-12 bg-gray-200 rounded-md overflow-hidden">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="leading-tight">
                          <div className="text-gray-400 text-sm">커피콩</div>
                          <div className="font-medium">{p.name}</div>
                        </div>
                      </button>

                      <div className="flex items-center gap-4">
                        <div className="text-gray-900">{formatKRW(p.price)}</div>
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-gray-800"
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => onToggleProduct(p.id, e.target.checked)}
                          aria-label={checked ? '카트에서 제거' : '카트에 추가'}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Summary */}
          <aside className="bg-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>

            <div className="space-y-3 mb-4">
              {summary.items.length === 0 ? (
                <div className="text-sm text-gray-500">장바구니가 비어 있습니다.</div>
              ) : (
                summary.items.map((it) => (
                  <div
                    key={it.itemId}
                    className="p-3 bg-white rounded-lg shadow-sm flex items-center justify-between"
                  >
                    <div className="text-sm">{it.name}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decreaseQty(it.productId)}
                        disabled={mutatingId === it.productId}
                        className="w-7 h-7 rounded border bg-white text-sm hover:bg-gray-50 disabled:opacity-40"
                        aria-label="감소"
                      >
                        −
                      </button>
                      <div className="min-w-8 text-center text-sm font-medium px-2 py-1 bg-white rounded border">
                        {it.qty}
                      </div>
                      <button
                        onClick={() => increaseQty(it.productId)}
                        disabled={mutatingId === it.productId}
                        className="w-7 h-7 rounded border bg-white text-sm hover:bg-gray-50 disabled:opacity-40"
                        aria-label="증가"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 주문자 정보 */}
            <div className="space-y-3">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="주소"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
              />
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="우편번호"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>

            <p className="mt-4 text-xs text-gray-600">
              당일 오후 2시 이후의 주문은 다음날 배송을 시작합니다.
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-700">총금액</span>
              <span className="text-base font-semibold">{formatKRW(summary.totalAmount)}</span>
            </div>

            {/* 항상 활성화 (중복 클릭 방지만 처리) */}
            <button
              disabled={paying}
              onClick={onPay}
              className="mt-4 w-full rounded-md bg-gray-900 text-white py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition"
            >
              {paying ? '처리 중…' : '결제하기'}
            </button>

            <div className="mt-3 text-[11px] text-gray-500">
              cartId: <span className="font-mono">{cartId ?? '(없음)'}</span>
            </div>
          </aside>
        </div>
      </div>

      {/* 상세 모달 */}
      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        data={detail}
      />
    </main>
  );
}
