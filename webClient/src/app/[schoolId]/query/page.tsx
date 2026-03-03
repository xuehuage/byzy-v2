'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftOutlined, SearchOutlined, PhoneOutlined } from '@ant-design/icons';
import { Typography, Button } from 'antd';
import { fetchStudentsByPhone } from '@/api/studentApi';
import Footer from '@/components/Footer';

const { Title, Text } = Typography;

export default function QueryPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    const router = useRouter();

    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleQuery = async () => {
        if (!phone || phone.length < 11) {
            setErrorMsg('请输入正确的手机号（11位）');
            return;
        }
        setErrorMsg('');
        setLoading(true);
        try {
            const res = await fetchStudentsByPhone(phone, Number(schoolId));
            sessionStorage.setItem('queryResults', JSON.stringify(res.data));
            sessionStorage.setItem('queryPhone', phone);
            router.push(`/${schoolId}/query/results`);
        } catch (err: any) {
            if (err.message?.includes('未找到')) {
                setErrorMsg('未找到该手机号对应的购买记录，请确认号码是否正确');
            } else {
                setErrorMsg(err.message || '查询失败，请稍后重试');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white px-6 py-4 flex items-center border-b sticky top-0 z-10 shadow-sm">
                <button onClick={() => router.back()} className="mr-4 text-gray-600 hover:text-blue-600 transition-colors">
                    <ArrowLeftOutlined style={{ fontSize: '20px' }} />
                </button>
                <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>查询订单</Title>
            </div>

            <main className="flex-1 flex flex-col items-center p-6 pt-16 max-w-md mx-auto w-full">
                <Title level={3} style={{ margin: '0 0 8px', textAlign: 'center', fontWeight: 800 }}>
                    输入手机号查询
                </Title>
                <Text type="secondary" className="text-center mb-10 text-sm block">
                    输入购买时留存的手机号，即可查看所有关联的订购记录
                </Text>

                {/* Input */}
                <div className="w-full mb-4">
                    <div className="relative">
                        <input
                            type="tel"
                            maxLength={11}
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value.replace(/\D/g, ''));
                                setErrorMsg('');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                            placeholder="请输入11位手机号"
                            className={`w-full h-14 px-5 pr-14 text-lg rounded-2xl border-2 focus:outline-none bg-white shadow-sm font-medium tracking-widest transition-all ${errorMsg ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                                }`}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-xl">
                            <PhoneOutlined />
                        </div>
                    </div>
                </div>

                {/* Inline error message */}
                {errorMsg && (
                    <div className="w-full mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                        {errorMsg}
                    </div>
                )}

                <Button
                    type="primary"
                    size="large"
                    block
                    loading={loading}
                    onClick={handleQuery}
                    icon={<SearchOutlined />}
                    className="h-14 rounded-2xl font-bold text-base bg-blue-600 border-none shadow-xl shadow-blue-200"
                >
                    立即查询
                </Button>
            </main>

            <Footer />
        </div>
    );
}
