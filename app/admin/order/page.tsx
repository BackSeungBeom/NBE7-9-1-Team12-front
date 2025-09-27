'use client';

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** ===== 공통 타입 ===== */
type RsData<T> = { resultCode: string; msg: string; data: T };

/** ===== 관리자 주문 DTO ===== */
type OrderItemResponse = {
  orderItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotalPrice: number;
};

type OrderResponse = {
  orderId: number;                 // Cart ID
  customerEmail: string;
  shipToAddress: string;
  shipToZipcode: string;
  orderDate: string;               // ISO 문자열(LocalDateTime)
  orderItems: OrderItemResponse[];
  totalAmount: number;
};

const formatKRW = (n: number) =>
  (n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '원';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // 파싱 실패 시 원문
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminOrderPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({}); // orderId -> opened
  const [dailyMode, setDailyMode] = useState(false); // ★ 금일 주문 모드

  /** 주문 목록 조회(전체) */
  const fetchOrders = async () => {
    setLoading(true);
    setErr(null);
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

      const res = await fetch('/api/admin/orders', {
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
        console.error('orders failed', res.status, await res.text());
        setErr('주문 목록을 불러오지 못했습니다.');
        return;
      }

      const json = await res.json();
      const data: OrderResponse[] = (json?.data ?? json) as OrderResponse[];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }; 

  /** 금일(일일 배치) 주문 조회 */
  const fetchDaily = async () => {
    setLoading(true);
    setErr(null);
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

      const res = await fetch('/api/admin/orders/dailyBatch', {
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
        console.error('dailyBatch failed', res.status, await res.text());
        setErr('금일 주문 목록을 불러오지 못했습니다.');
        return;
      }

      const json = await res.json();
      const data: OrderResponse[] = (json?.data ?? json) as OrderResponse[];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /** 현재 모드에 맞춰 새로고침 */
  const refresh = () => {
    if (dailyMode) return fetchDaily();
    return fetchOrders();
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /** 클라이언트 필터링 */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.customerEmail, o.shipToAddress, o.shipToZipcode, String(o.orderId)]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [orders, query]);

  /** 로그아웃 */
  const logout = () => {
    localStorage.removeItem('adminToken');
    router.replace('/admin/login');
  };

  /** 토글/펼침 제어 */
  const toggleOne = (orderId: number) =>
    setExpanded((p) => ({ ...p, [orderId]: !p[orderId] }));

  const expandAll = () =>
    setExpanded(Object.fromEntries(filtered.map((o) => [o.orderId, true])));

  const collapseAll = () => setExpanded({});

  /** 모드 전환 */
  const switchToDaily = async () => {
    if (!dailyMode) {
      setExpanded({});
      setDailyMode(true);
      await fetchDaily();
    }
  };
  const switchToAll = async () => {
    if (dailyMode) {
      setExpanded({});
      setDailyMode(false);
      await fetchOrders();
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 헤더: 제목 + 우측 액션(제품관리/로그아웃) */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">주문 관리</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/products"
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              제품 관리
            </Link>
            <button
              onClick={logout}
              className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm hover:opacity-90"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 모드 배지 */}
        <div className="mb-4">
          {dailyMode ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs">
              금일 주문 모드
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-200 text-gray-700 px-3 py-1 text-xs">
              전체 주문 모드
            </span>
          )}
        </div>

        {/* 검색 + 버튼들(모두 펼치기/모두 접기/새로고침/금일 주문/전체 주문) */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이메일/주소/우편번호/주문ID 검색…"
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
              onClick={refresh}
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              새로고침
            </button>

            {/* 모드 전환 버튼 */}
            <button
              onClick={switchToDaily}
              className={`rounded-md px-3 py-1.5 text-sm ${
                dailyMode
                  ? 'bg-gray-900 text-white'
                  : 'border bg-white hover:bg-gray-50'
              }`}
              title="금일(일일 배송 대상) 주문만 보기"
            >
              금일 주문
            </button>
            <button
              onClick={switchToAll}
              className={`rounded-md px-3 py-1.5 text-sm ${
                !dailyMode
                  ? 'bg-gray-900 text-white'
                  : 'border bg-white hover:bg-gray-50'
              }`}
              title="전체 주문 보기"
            >
              전체 주문
            </button>
          </div>
        </div>

        {/* 상태 표시 */}
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
                  <th className="px-4 py-3 text-left">주문ID</th>
                  <th className="px-4 py-3 text-left">주문일시</th>
                  <th className="px-4 py-3 text-left">이메일</th>
                  <th className="px-4 py-3 text-left">주소</th>
                  <th className="px-4 py-3 text-left">우편번호</th>
                  <th className="px-4 py-3 text-right">총액</th>
                  <th className="px-4 py-3 text-center">품목수</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      주문이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const isOpen = !!expanded[o.orderId];
                    const detailsId = `order-${o.orderId}-details`;
                    return (
                      <Fragment key={o.orderId}>
                        {/* 요약 행 */}
                        <tr className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleOne(o.orderId)}
                              className="bg-white px-2 py-1 text-xs hover:bg-gray-50 rounded"
                              aria-expanded={isOpen}
                              aria-controls={detailsId}
                            >
                              {isOpen ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium">#{o.orderId}</td>
                          <td className="px-4 py-3">{formatDate(o.orderDate)}</td>
                          <td className="px-4 py-3">{o.customerEmail || 'N/A'}</td>
                          <td className="px-4 py-3">{o.shipToAddress || 'N/A'}</td>
                          <td className="px-4 py-3">{o.shipToZipcode || 'N/A'}</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatKRW(o.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {o.orderItems?.length ?? 0}
                          </td>
                        </tr>

                        {/* 상세(품목) 행 */}
                        {isOpen && (
                          <tr id={detailsId} className="border-t bg-gray-50/60">
                            <td colSpan={8} className="px-6 py-4">
                              {o.orderItems?.length ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead className="text-gray-600">
                                      <tr>
                                        <th className="px-2 py-2 text-left">OrderItem ID</th>
                                        <th className="px-2 py-2 text-left">상품명</th>
                                        <th className="px-2 py-2 text-center">수량</th>
                                        <th className="px-2 py-2 text-right">단가</th>
                                        <th className="px-2 py-2 text-right">소계</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {o.orderItems.map((it) => (
                                        <tr key={it.orderItemId} className="border-t">
                                          <td className="px-2 py-2">#{it.orderItemId}</td>
                                          <td className="px-2 py-2">{it.productName}</td>
                                          <td className="px-2 py-2 text-center">
                                            {it.quantity}
                                          </td>
                                          <td className="px-2 py-2 text-right">
                                            {formatKRW(it.unitPrice)}
                                          </td>
                                          <td className="px-2 py-2 text-right">
                                            {formatKRW(it.subtotalPrice)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">품목이 없습니다.</div>
                              )}
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
