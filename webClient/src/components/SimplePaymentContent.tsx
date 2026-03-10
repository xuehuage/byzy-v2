// components/SimplePaymentContent.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchPrepay } from '@/api/paymentApi';
import { PrepayResponse } from '@/types/payment.types';
import { StudentDetailResponse } from '@/types/student.types';
import { fetchStudentDetail, fetchStudentDetailById, fetchTempOrder } from '@/api/studentApi';
import { usePaymentStatusManager } from '@/hooks/usePaymentStatusManager';
import PaymentLayout from '@/components/PaymentLayout';
import PaymentResult from '@/components/PaymentResult';
import { QRCodeSVG } from 'qrcode.react';
const PAYMENT_EXPIRY_SECONDS = 5 * 60;

interface StoredOrder {
    client_sn: string;
    prepayData: PrepayResponse['data'];
    createdAt: number;
    expiresAt: number;
    studentIdNumber: string;
    studentId?: number;
}

export default function SimplePaymentContent({ schoolId }: { schoolId?: string }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    // 使用 ref 存储参数，避免 searchParams 变化导致重渲染
    const paymentParamsRef = useRef({
        paymentMethod: searchParams.get('method') || '',
        studentIdNumber: searchParams.get('id') || '',
        studentId: searchParams.get('studentId') || '',
        tempOrderId: searchParams.get('tempOrderId') || ''
    });

    // 状态管理
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [prepayData, setPrepayData] = useState<PrepayResponse['data'] | null>(null);
    const [studentInfo, setStudentInfo] = useState<StudentDetailResponse['data']['student'] | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(PAYMENT_EXPIRY_SECONDS);
    const [isExpired, setIsExpired] = useState(false);
    const [orderStatus, setOrderStatus] = useState<'PAID' | 'PAY_CANCELED' | null>(null);

    // 🔥 使用统一的支付状态管理器
    const {
        currentMode,
        connectionStatus,
        isWebSocketConnected,
        isPolling,
        initializePaymentStatus,
        manualCheckStatus,
        cleanup
    } = usePaymentStatusManager();

    // 防止重复初始化和清理
    const initializedRef = useRef(false);
    const requestLockRef = useRef(false);
    const componentMountedRef = useRef(true);

    // 处理支付成功
    const handlePaymentSuccess = useCallback((paymentData: any) => {
        console.log('💰 支付成功处理');
        setOrderStatus('PAID');
        localStorage.removeItem('paymentOrder');
        const studentIdKey = paymentParamsRef.current.studentId || paymentParamsRef.current.studentIdNumber;
        localStorage.setItem(`paid_${studentIdKey}`, Date.now().toString());
    }, []);

    // 获取预支付信息
    const getPrepayInfo = useCallback(async () => {
        if (requestLockRef.current || !componentMountedRef.current) return;
        requestLockRef.current = true;

        try {
            setLoading(true);
            setError('');

            const { paymentMethod, studentIdNumber, studentId, tempOrderId } = paymentParamsRef.current;

            if (!paymentMethod || (!studentIdNumber && !studentId && !tempOrderId)) {
                throw new Error('参数错误，无法进行支付');
            }

            // 获取学生详情
            let studentDetail;
            if (tempOrderId) {
                studentDetail = await fetchTempOrder(Number(tempOrderId));
            } else if (studentId) {
                studentDetail = await fetchStudentDetailById(Number(studentId), Number(schoolId));
            } else {
                studentDetail = await fetchStudentDetail(studentIdNumber, Number(schoolId));
            }

            if (!componentMountedRef.current) return;
            setStudentInfo(studentDetail.data.student);

            // 获取预支付信息
            const prepayResponse = await fetchPrepay({
                id_card: studentIdNumber || undefined,
                student_id: studentId ? Number(studentId) : undefined,
                temp_order_id: tempOrderId ? Number(tempOrderId) : undefined,
                pay_way: paymentMethod
            });

            if (!componentMountedRef.current) return;
            setPrepayData(prepayResponse.data);

            // 存储订单信息
            const storedOrder: StoredOrder = {
                client_sn: prepayResponse.data.client_sn,
                prepayData: prepayResponse.data,
                createdAt: Date.now(),
                expiresAt: Date.now() + (PAYMENT_EXPIRY_SECONDS * 1000),
                studentIdNumber: studentIdNumber,
                studentId: studentId ? Number(studentId) : undefined
            };
            localStorage.setItem('paymentOrder', JSON.stringify(storedOrder));

            setRemainingSeconds(PAYMENT_EXPIRY_SECONDS);
            setIsExpired(false);

            // 🔥 初始化支付状态监听
            console.log('🔄 初始化支付状态监听');
            initializePaymentStatus({
                clientSn: prepayResponse.data.client_sn,
                onPaymentSuccess: handlePaymentSuccess
            });

        } catch (err) {
            if (!componentMountedRef.current) return;
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('❌ 获取支付信息失败:', errorMessage);
            setError(errorMessage);
        } finally {
            if (componentMountedRef.current) {
                setLoading(false);
            }
            requestLockRef.current = false;
        }
    }, [initializePaymentStatus, handlePaymentSuccess]);

    // 检查存储的订单
    const checkStoredOrder = useCallback(() => {
        try {
            const stored = localStorage.getItem('paymentOrder');
            if (!stored) return null;

            const order: StoredOrder = JSON.parse(stored);
            const now = Date.now();

            // 检查是否过期或学生不匹配
            const currentIdKey = paymentParamsRef.current.studentId || paymentParamsRef.current.studentIdNumber;
            if (now > order.expiresAt ||
                (order.studentIdNumber !== currentIdKey && order.studentId?.toString() !== currentIdKey)) {
                localStorage.removeItem('paymentOrder');
                return null;
            }

            return order;
        } catch {
            localStorage.removeItem('paymentOrder');
            return null;
        }
    }, []);

    // 计算剩余时间的函数
    const calculateRemainingSeconds = useCallback(() => {
        const storedOrder = checkStoredOrder();
        if (!storedOrder) return 0;

        const now = Date.now();
        const remainingMs = storedOrder.expiresAt - now;
        return Math.max(0, Math.floor(remainingMs / 1000));
    }, [checkStoredOrder]);

    // 初始化 - 使用更安全的生命周期管理
    useEffect(() => {
        componentMountedRef.current = true;

        // 如果已经初始化，直接返回
        if (initializedRef.current) {
            return;
        }

        initializedRef.current = true;

        console.log('🏁 开始初始化支付组件');

        const init = async () => {
            setLoading(true);
            setError('');

            try {
                // 1. MUST fetch fresh student detail first
                const { studentId, studentIdNumber, tempOrderId } = paymentParamsRef.current;
                if (!studentId && !studentIdNumber && !tempOrderId) throw new Error('未提供学生标识');

                let orderDetailRes;
                if (tempOrderId) {
                    orderDetailRes = await fetchTempOrder(Number(tempOrderId));
                } else if (studentId) {
                    orderDetailRes = await fetchStudentDetailById(Number(studentId), Number(schoolId));
                } else {
                    orderDetailRes = await fetchStudentDetail(studentIdNumber, Number(schoolId));
                }

                if (!componentMountedRef.current) return;

                const freshStudent = orderDetailRes.data.student;
                const freshOrders = orderDetailRes.data.orders || [];
                setStudentInfo(freshStudent);

                // Calculate current total for unpaid items (in Yuan)
                const currentUnpaidTotalYuan = tempOrderId
                    ? (Number(orderDetailRes.data.total_amount) > 1000 ? Number(orderDetailRes.data.total_amount) / 100 : Number(orderDetailRes.data.total_amount))
                    : freshOrders
                        .filter((o: any) => o.payment_status === 0)
                        .reduce((sum: number, o: any) => sum + (Number(o.total_amount) / 100), 0);

                // 2. Check localStorage
                const storedOrder = checkStoredOrder();

                if (storedOrder) {
                    const cachedAmount = Number(storedOrder.prepayData.total_amount);

                    // 3. VALIDATE: Restore cache ONLY if amount matches and not expired
                    // Using a small epsilon for float comparison just in case
                    if (Math.abs(cachedAmount - currentUnpaidTotalYuan) < 0.01) {
                        console.log('✅ 缓存金额匹配，恢复之前的支付状态');
                        setPrepayData(storedOrder.prepayData);

                        const initialRemainingSeconds = calculateRemainingSeconds();
                        setRemainingSeconds(initialRemainingSeconds);

                        if (initialRemainingSeconds <= 0) {
                            setIsExpired(true);
                            localStorage.removeItem('paymentOrder');
                            cleanup();
                        } else {
                            initializePaymentStatus({
                                clientSn: storedOrder.client_sn,
                                onPaymentSuccess: handlePaymentSuccess
                            });
                        }
                        setLoading(false);
                        return; // Found valid cache, stop here
                    } else {
                        console.log('🔄 订单金额由于管理员修改已变动，忽略旧缓存，生成新预支付信息');
                        console.log(`Cached: ${cachedAmount}, Actual: ${currentUnpaidTotalYuan}`);
                        localStorage.removeItem('paymentOrder');
                    }
                }

                // 4. No valid cache found or amount mismatch, create NEW prepay
                await getPrepayInfo();

                // 检查是否已支付 (Check if paid locally recently)
                const paidTime = localStorage.getItem(`paid_${studentId}`);
                if (paidTime && (Date.now() - parseInt(paidTime) < 5 * 60 * 1000)) {
                    setOrderStatus('PAID');
                }
            } catch (err) {
                if (!componentMountedRef.current) return;
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                if (componentMountedRef.current) {
                    setLoading(false);
                }
            }
        };

        // 延迟初始化，确保组件稳定
        const initTimer = setTimeout(() => {
            if (componentMountedRef.current) {
                init();
            }
        }, 100);

        // 清理函数 - 只在组件真正卸载时执行
        return () => {
            console.log('🧹 组件卸载，执行清理');
            componentMountedRef.current = false;
            clearTimeout(initTimer);
            cleanup();
        };
    }, []); // 空依赖数组，确保只运行一次

    // 基于系统时间的精确倒计时 - 修复所有定时器问题
    useEffect(() => {
        if (loading || isExpired || !prepayData || orderStatus === 'PAID') return;

        // 立即计算并设置一次
        const currentRemaining = calculateRemainingSeconds();
        setRemainingSeconds(currentRemaining);

        if (currentRemaining <= 0) {
            setIsExpired(true);
            localStorage.removeItem('paymentOrder');
            console.log('⏰ 订单已过期，清理所有监听');
            cleanup();
            return;
        }

        // 设置一个定时器，但只在需要更新显示时运行
        let timeoutId: NodeJS.Timeout;

        const scheduleNextUpdate = () => {
            const nowRemaining = calculateRemainingSeconds();

            // 只有当剩余时间变化时才更新状态
            if (nowRemaining !== remainingSeconds) {
                setRemainingSeconds(nowRemaining);
            }

            if (nowRemaining <= 0) {
                setIsExpired(true);
                localStorage.removeItem('paymentOrder');
                console.log('⏰ 订单已过期，清理所有监听');
                cleanup();
                return;
            }

            // 根据剩余时间动态调整更新频率
            let nextUpdateDelay = 1000; // 默认1秒

            if (nowRemaining > 60) {
                nextUpdateDelay = 5000; // 超过1分钟时，每5秒更新一次
            } else if (nowRemaining > 10) {
                nextUpdateDelay = 1000; // 10秒到1分钟，每秒更新
            } else {
                nextUpdateDelay = 200; // 最后10秒，每200毫秒更新以获得更流畅的体验
            }

            timeoutId = setTimeout(scheduleNextUpdate, nextUpdateDelay);
        };

        timeoutId = setTimeout(scheduleNextUpdate, 1000);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [loading, isExpired, prepayData, orderStatus, cleanup, calculateRemainingSeconds, remainingSeconds]);

    // 添加页面可见性变化监听
    useEffect(() => {
        if (loading || isExpired || !prepayData || orderStatus === 'PAID') return;

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // 页面变为可见时，立即重新计算剩余时间
                const currentRemaining = calculateRemainingSeconds();
                setRemainingSeconds(currentRemaining);

                if (currentRemaining <= 0) {
                    setIsExpired(true);
                    localStorage.removeItem('paymentOrder');
                    console.log('⏰ 页面恢复时发现订单已过期，清理所有监听');
                    cleanup();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [loading, isExpired, prepayData, orderStatus, cleanup, calculateRemainingSeconds]);

    // 手动查询支付状态
    const handleManualCheck = async () => {
        const clientSn = prepayData?.client_sn;
        if (!clientSn || loading) return;

        try {
            const status = await manualCheckStatus();
            if (status === 'PAID') {
                console.log('✅ 手动检查确认支付成功');
            }
        } catch (err) {
            console.error('手动查询支付状态失败:', err);
        }
    };

    // 返回首页
    const handleGoHome = () => router.push(`/${schoolId || ''}`);

    // 返回上一步
    const handleBack = () => {
        const idCard = paymentParamsRef.current.studentIdNumber;
        const studentId = paymentParamsRef.current.studentId;
        // 如果有身份证号优先使用身份证号，否则使用数据库ID
        const queryParam = idCard ? `?id=${idCard}` : (studentId ? `?studentId=${studentId}` : '');
        router.push(`/${schoolId}/order${queryParam}`);
    };

    // 获取支付方式文本
    const getPaymentMethodText = () => {
        switch (paymentParamsRef.current.paymentMethod) {
            case '3': return '微信支付';
            case '2': return '支付宝';
            default: return '';
        }
    };

    // 格式化时间
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 获取连接状态文本和样式
    const getConnectionStatusInfo = () => {
        // 🔥 如果订单已过期，强制显示"已断开"
        if (isExpired) {
            return { text: '已断开', className: 'text-gray-500', icon: '⚪' };
        }

        switch (connectionStatus) {
            case 'connected':
                return { text: '实时连接', className: 'text-green-500', icon: '🟢' };
            case 'degraded':
                return { text: '轮询模式', className: 'text-yellow-500', icon: '🟡' };
            case 'connecting':
                return { text: '连接中...', className: 'text-blue-500', icon: '🔵' };
            default:
                return { text: '连接中...', className: 'text-gray-500', icon: '⚪' };
        }
    };

    // const statusInfo = getConnectionStatusInfo();

    // 加载状态
    if (loading && !orderStatus) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">加载支付信息中...</p>
                </div>
            </div>
        );
    }

    // 支付成功
    if (orderStatus === 'PAID') {
        return (
            <PaymentLayout title="支付结果">
                <PaymentResult
                    type="success"
                    title="付款成功"
                    description="您已成功完成支付，感谢您的购买"
                    studentInfo={studentInfo || undefined}
                    amount={prepayData?.total_amount || '0.00'}
                    onAction={handleGoHome}
                    actionText="返回首页"
                />
            </PaymentLayout>
        );
    }

    // 主支付页面
    return (
        <PaymentLayout title="支付页面">
            <div className="max-w-md mx-auto w-full bg-white rounded-xl shadow-md p-6">
                {error ? (
                    <div className="text-center text-red-500 mb-6">
                        <p>{error}</p>
                        <button
                            onClick={() => router.push(`/${schoolId || ''}`)}
                            className="mt-4 text-blue-600 hover:underline"
                        >
                            返回首页
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* 学生信息 */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">学生信息</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-600">学生姓名：</span>
                                    <span className="font-medium">{studentInfo?.name || '未知'}</span>
                                </div>
                                {(studentInfo?.grade_name || (studentInfo?.class_name && studentInfo.class_name !== '未分班')) && (
                                    <div className="flex justify-between py-2 border-b border-gray-200">
                                        <span className="text-gray-600">年级/班级：</span>
                                        <span className="font-medium">
                                            {studentInfo.grade_name || ''} {studentInfo.class_name && studentInfo.class_name !== '未分班' ? studentInfo.class_name : ''}
                                        </span>
                                    </div>
                                )}
                                {studentInfo?.phone && (
                                    <div className="flex justify-between py-2 border-b border-gray-200">
                                        <span className="text-gray-600">手机号：</span>
                                        <span className="font-medium">{studentInfo.phone}</span>
                                    </div>
                                )}
                                {studentInfo?.birthday && (
                                    <div className="flex justify-between py-2 border-b border-gray-200">
                                        <span className="text-gray-600">出生日期：</span>
                                        <span className="font-medium">{studentInfo.birthday}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 订单信息 */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">订单信息</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-600">支付方式：</span>
                                    <span className="font-medium">{getPaymentMethodText()}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-600">订单总金额：</span>
                                    <span className="font-medium">¥{prepayData?.total_amount || '0.00'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-600">订单描述：</span>
                                    <span className="font-medium">{prepayData?.subject || '校服订单'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 支付二维码 */}
                        <div className="text-center">
                            <h2 className="text-lg font-semibold text-gray-800 ">二维码有效期：<span className='text-red-600'>{formatTime(remainingSeconds)}</span></h2>

                            <div className="relative mx-auto w-64 h-64 mb-4">
                                {prepayData?.qr_code_image_url ? (
                                    <img
                                        src={prepayData.qr_code_image_url}
                                        alt="二维码"
                                        style={{
                                            width: 256,
                                            height: 256,
                                            display: 'block'
                                        }}
                                    />
                                ) : (
                                    prepayData?.qr_code && (
                                        <div className="bg-white p-2 inline-block rounded-lg shadow-sm">
                                            <QRCodeSVG
                                                value={prepayData.qr_code}
                                                size={240}
                                                level="H"
                                                includeMargin={true}
                                            />
                                        </div>
                                    )
                                )}

                                {isExpired && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center rounded-lg">
                                        <p className="text-white font-medium mb-4">二维码已过期</p>
                                        <button
                                            onClick={getPrepayInfo}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                            disabled={loading}
                                        >
                                            {loading ? '生成中...' : '刷新二维码'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <p className="text-sm text-gray-600 mb-2">
                                请长按二维码识别或保存二维码到相册，用{getPaymentMethodText()}扫一扫进行付款
                            </p>
                            <p className="text-sm text-red-600">
                                *请在二维码失效前扫码
                            </p>

                            {/* 连接状态显示 */}
                            {/* <div className={`text-xs ${statusInfo.className} text-center mt-2`}>
                                {statusInfo.icon} {statusInfo.text}
                                {currentMode === 'polling' && ' (降级模式)'}
                            </div> */}
                        </div>

                        {/* 操作按钮 */}
                        <div className="space-y-4 pt-4">
                            {!isExpired && (
                                <button
                                    type="button"
                                    onClick={handleManualCheck}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                                    disabled={loading}
                                >
                                    {loading ? '查询中...' : '我已付款'}
                                </button>
                            )}

                            {/* 操作按钮 - 正常调用时不展示导航按钮 */}
                            {(error || !prepayData) && (
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="flex-1 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm"
                                    >
                                        返回上一步
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGoHome}
                                        className="flex-1 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                                    >
                                        回到首页
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </PaymentLayout>
    );
}