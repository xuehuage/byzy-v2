'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftOutlined, SwapOutlined, UndoOutlined } from '@ant-design/icons';
import { Typography, Tag, Card, Button, Empty, message, Modal, Input, InputNumber, Divider } from 'antd';
import Footer from '@/components/Footer';
import axiosInstance from 'src/utils/axiosInstance';

const { Title, Text } = Typography;

const uniformTypeText: Record<number, string> = { 1: '夏季校服', 2: '春秋校服', 3: '冬季校服' };

function formatAmount(val: any) {
    const num = Number(val);
    if (isNaN(num)) return '0.00';
    return num > 1000 ? (num / 100).toFixed(2) : num.toFixed(2);
}

export default function QueryDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    const router = useRouter();
    const [studentData, setStudentData] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Exchange modal state
    const [exchangeModal, setExchangeModal] = useState<{ open: boolean; orderId: number; currentSize: string; maxQty: number } | null>(null);
    const [newSize, setNewSize] = useState('');

    // Refund modal state
    const [refundModal, setRefundModal] = useState<{ open: boolean; orderId: number; maxQty: number; orderName: string } | null>(null);
    const [refundQty, setRefundQty] = useState(1);

    useEffect(() => {
        const data = sessionStorage.getItem('selectedStudent');
        if (data) setStudentData(JSON.parse(data));
    }, []);

    const updateOrderStatus = (orderId: number, orderStatus: string) => {
        setStudentData((prev: any) => ({
            ...prev,
            orders: prev.orders.map((o: any) =>
                o.order_id === orderId ? { ...o, order_status: orderStatus } : o
            )
        }));
    };

    const handleExchangeSubmit = async () => {
        if (!newSize.trim()) {
            message.warning('请填写希望换成的尺码');
            return;
        }
        setActionLoading(true);
        try {
            const order = studentData.orders.find((o: any) => o.order_id === exchangeModal?.orderId);
            const primaryItem = order?.items?.[0];
            await axiosInstance.post('/public/after-sales', {
                order_id: exchangeModal?.orderId,
                type: 'EXCHANGE',
                original_size: primaryItem?.size || '',
                new_size: newSize,
                original_quantity: primaryItem?.quantity ?? 1,
                new_quantity: primaryItem?.quantity ?? 1,
            });
            message.success('调换申请已提交，请等待管理员处理');
            setExchangeModal(null);
            if (exchangeModal?.orderId) updateOrderStatus(exchangeModal.orderId, 'EXCHANGE_PENDING');
        } catch (err: any) {
            message.error(err.message || '提交失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRefundSubmit = async () => {
        setActionLoading(true);
        try {
            const order = studentData.orders.find((o: any) => o.order_id === refundModal?.orderId);
            const primaryItem = order?.items?.[0];
            await axiosInstance.post('/public/after-sales', {
                order_id: refundModal?.orderId,
                type: 'REFUND',
                original_size: primaryItem?.size || '',
                original_quantity: primaryItem?.quantity ?? 1,
                new_quantity: refundQty,
            });
            message.success('退款申请已提交，请等待管理员处理');
            setRefundModal(null);
            if (refundModal?.orderId) updateOrderStatus(refundModal.orderId, 'REFUND_PENDING');
        } catch (err: any) {
            message.error(err.message || '提交失败');
        } finally {
            setActionLoading(false);
        }
    };

    if (!studentData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Empty description="无数据，请返回重新查询" />
                    <Button type="primary" className="mt-4" onClick={() => router.back()}>返回</Button>
                </div>
            </div>
        );
    }

    const { student, orders } = studentData;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-24">
            {/* Header */}
            <div className="bg-white px-6 py-4 flex items-center border-b sticky top-0 z-10 shadow-sm">
                <button onClick={() => router.back()} className="mr-4 text-gray-600 hover:text-blue-600 transition-colors">
                    <ArrowLeftOutlined style={{ fontSize: '20px' }} />
                </button>
                <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>订单详情</Title>
            </div>

            <main className="flex-1 p-6 max-w-md mx-auto w-full">
                {/* Student Info Card — clean label/value grid, no icons */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 mb-6 shadow-xl shadow-blue-200">
                    <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-4">学生信息</div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">姓名</div>
                            <div className="text-white font-bold text-base">{student.name || '—'}</div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">手机号</div>
                            <div className="text-white font-bold text-base">{student.phone || '—'}</div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">班级</div>
                            <div className="text-white font-bold text-base">
                                {student.class_name && student.class_name !== '未分班' ? student.class_name : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">出生日期</div>
                            <div className="text-white font-bold text-base">{student.birthday || '—'}</div>
                        </div>
                    </div>
                </div>

                {/* Orders */}
                <div className="mb-3">
                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                        订购清单 ({orders.length} 条)
                    </Text>
                </div>

                {orders.length > 0 ? (
                    <div className="space-y-6">
                        {orders.map((order: any, idx: number) => (
                            <Card key={order.order_id || idx} className="rounded-3xl border border-gray-100 shadow-lg" bodyStyle={{ padding: 0 }}>
                                {/* Order Header */}
                                <div className="px-6 py-4 flex justify-between items-center bg-gray-50/80 border-b border-gray-100 rounded-t-3xl">
                                    <div className="flex flex-col">
                                        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">订单编号</Text>
                                        <Text strong className="text-sm font-mono text-gray-700">{order.order_no}</Text>
                                    </div>
                                    {order.order_status === 'REFUNDING' ? (
                                        <Tag color="orange" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">退款审核中</Tag>
                                    ) : order.order_status === 'EXCHANGING' ? (
                                        <Tag color="blue" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">调换审核中</Tag>
                                    ) : order.order_status === 'SHIPPED' ? (
                                        <Tag color="cyan" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">已发货</Tag>
                                    ) : order.order_status === 'REFUNDED' ? (
                                        <Tag color="error" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">已退款</Tag>
                                    ) : (
                                        <Tag
                                            color={order.payment_status === 1 ? 'success' : 'warning'}
                                            className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm"
                                        >
                                            {order.payment_status === 1 ? '已付款' : '待付款'}
                                        </Tag>
                                    )}
                                </div>

                                {/* Order Items List */}
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        {order.items.map((item: any, iidx: number) => (
                                            <div key={item.id || iidx} className="flex items-start gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                                    <span className="text-blue-600 font-bold text-lg">{uniformTypeText[item.uniform_type]?.[0] || '服'}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between">
                                                        <Text strong className="text-base text-gray-800">{uniformTypeText[item.uniform_type] || item.product_name}</Text>
                                                        <Text strong className="text-gray-900">¥ {(Number(item.price) / 100).toFixed(2)}</Text>
                                                    </div>
                                                    <div className="flex gap-4 mt-2">
                                                        <div className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-500 font-medium">
                                                            尺码：{item.size || '以实际发放为准'}
                                                        </div>
                                                        <div className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-500 font-medium">
                                                            数量：{item.quantity} 套
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Order Summary */}
                                    <div className="flex justify-between items-center pt-2">
                                        <Text className="text-xs text-gray-400 font-bold uppercase tracking-widest">实付总金额</Text>
                                        <div className="text-right">
                                            <span className="text-xs mr-1 font-medium text-gray-800">¥</span>
                                            <span className="text-2xl font-black text-gray-900 tracking-tight">
                                                {formatAmount(order.total_amount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {order.payment_status === 1 && order.order_status !== 'REFUNDING' && order.order_status !== 'EXCHANGING' && order.order_status !== 'REFUNDED' && (
                                        <div className="flex gap-3 pt-6 mt-2 border-t border-dashed border-gray-100">
                                            {/* Exchange allowed for PAID and SHIPPED */}
                                            {(order.order_status === 'PAID' || order.order_status === 'SHIPPED') && (
                                                <Button
                                                    block
                                                    icon={<SwapOutlined />}
                                                    className="rounded-2xl h-12 font-bold text-sm text-blue-600 bg-blue-50 border-none hover:bg-blue-100 transition-all"
                                                    onClick={() => {
                                                        setNewSize('');
                                                        const primaryItem = order.items?.[0] || order;
                                                        setExchangeModal({
                                                            open: true,
                                                            orderId: order.order_id || order.id,
                                                            currentSize: primaryItem?.size,
                                                            maxQty: primaryItem?.quantity
                                                        });
                                                    }}
                                                >
                                                    申请调换
                                                </Button>
                                            )}
                                            {/* Refund ONLY allowed for PAID (not SHIPPED) */}
                                            {order.order_status === 'PAID' && (
                                                <Button
                                                    block
                                                    danger
                                                    icon={<UndoOutlined />}
                                                    className="rounded-2xl h-12 font-bold text-sm bg-red-50 border-none hover:bg-red-100 transition-all"
                                                    onClick={() => {
                                                        setRefundQty(1);
                                                        const primaryItem = order.items?.[0] || order;
                                                        setRefundModal({
                                                            open: true,
                                                            orderId: order.order_id || order.id,
                                                            maxQty: primaryItem?.quantity || 1,
                                                            orderName: order.items ? order.items.map((i: any) => uniformTypeText[i.uniform_type] || '校服').join(' + ') : '校服'
                                                        });
                                                    }}
                                                >
                                                    申请退款
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {(order.order_status === 'REFUNDING' || order.order_status === 'EXCHANGING') && (
                                        <div className="mt-4 pt-4 border-t border-dashed border-gray-100 text-center">
                                            <Text type="secondary" className="text-xs">
                                                {order.order_status === 'REFUNDING'
                                                    ? '🕐 退款申请已提交，等待管理员审核，审核完成后将退款至原账户'
                                                    : '🕐 调换申请已提交，等待管理员联系处理'}
                                            </Text>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 bg-white rounded-[40px] shadow-sm flex flex-col items-center border border-gray-100">
                        <Empty description={<span className="text-gray-400 font-medium">暂无订购记录</span>} />
                        <Button type="primary" className="mt-6 rounded-2xl h-12 px-8 font-bold" onClick={() => router.back()}>返回查询</Button>
                    </div>
                )}
            </main>

            {/* Exchange Modal */}
            <Modal
                title="申请调换尺码"
                open={!!exchangeModal?.open}
                onOk={handleExchangeSubmit}
                onCancel={() => setExchangeModal(null)}
                confirmLoading={actionLoading}
                okText="提交申请"
                cancelText="取消"
            >
                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <Text type="secondary" className="text-sm">当前尺码</Text>
                        <Text strong className="text-base">{exchangeModal?.currentSize || '未知'}</Text>
                    </div>
                    <div>
                        <Text type="secondary" className="text-sm block mb-2">希望换成的尺码</Text>
                        <Input
                            placeholder="请输入新尺码，例如 165#"
                            value={newSize}
                            onChange={(e) => setNewSize(e.target.value)}
                            size="large"
                            className="rounded-xl"
                        />
                    </div>
                </div>
            </Modal>

            {/* Refund Modal */}
            <Modal
                title="申请退款"
                open={!!refundModal?.open}
                onOk={handleRefundSubmit}
                onCancel={() => setRefundModal(null)}
                confirmLoading={actionLoading}
                okText="确认申请退款"
                okButtonProps={{ danger: true }}
                cancelText="取消"
            >
                <div className="py-4 space-y-5">
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-700 leading-relaxed">
                        退款申请提交后，管理员审核通过后将退款至原支付账户，审核期间无法再次申请。
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <Text type="secondary" className="text-sm">退款商品</Text>
                        <Text strong>{refundModal?.orderName}</Text>
                    </div>
                    <div>
                        <Text type="secondary" className="text-sm block mb-3">
                            申请退款套数（已购 {refundModal?.maxQty} 套）
                        </Text>
                        <div className="flex items-center gap-4">
                            <InputNumber
                                min={1}
                                max={refundModal?.maxQty || 1}
                                value={refundQty}
                                onChange={(v) => setRefundQty(v || 1)}
                                size="large"
                                className="w-32 rounded-xl"
                            />
                            <Text type="secondary" className="text-sm">套</Text>
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {Array.from({ length: refundModal?.maxQty || 1 }, (_, i) => i + 1).map(n => (
                                <button
                                    key={n}
                                    onClick={() => setRefundQty(n)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${refundQty === n
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                                        }`}
                                >
                                    {n} 套
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            <Footer />
        </div>
    );
}
