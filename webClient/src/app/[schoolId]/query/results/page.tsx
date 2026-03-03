'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftOutlined, UserOutlined, RightOutlined } from '@ant-design/icons';
import { Typography, Tag, Empty } from 'antd';
import Footer from '@/components/Footer';

const { Title, Text } = Typography;

const typeText: Record<number, string> = { 1: '夏季校服', 2: '春秋校服', 3: '冬季校服' };

export default function QueryResultsPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    const router = useRouter();
    const [students, setStudents] = useState<any[]>([]);
    const [phone, setPhone] = useState('');

    useEffect(() => {
        const data = sessionStorage.getItem('queryResults');
        const p = sessionStorage.getItem('queryPhone');
        if (data) {
            setStudents(JSON.parse(data));
        }
        if (p) setPhone(p);
    }, []);

    const handleCardClick = (studentData: any) => {
        sessionStorage.setItem('selectedStudent', JSON.stringify(studentData));
        router.push(`/${schoolId}/query/detail`);
    };

    const getPaidCount = (orders: any[]) =>
        orders.filter((o: any) => o.payment_status === 1).length;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-20">
            {/* Header */}
            <div className="bg-white px-6 py-4 flex items-center border-b sticky top-0 z-10 shadow-sm">
                <button onClick={() => router.back()} className="mr-4 text-gray-600 hover:text-blue-600 transition-colors">
                    <ArrowLeftOutlined style={{ fontSize: '20px' }} />
                </button>
                <div className="flex-1">
                    <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>查询结果</Title>
                    <Text type="secondary" className="text-xs">手机号：{phone}</Text>
                </div>
                <Tag color="blue" className="rounded-full font-bold">{students.length} 位学生</Tag>
            </div>

            <main className="flex-1 p-6 max-w-md mx-auto w-full">
                {students.length > 0 ? (
                    <div className="space-y-4">
                        {students.map((s: any, idx: number) => (
                            <div
                                key={s.student.id || idx}
                                onClick={() => handleCardClick(s)}
                                className="bg-white rounded-3xl shadow-md shadow-blue-50/60 border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:shadow-lg"
                            >
                                {/* Card Top Gradient */}
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                            <UserOutlined style={{ fontSize: '22px', color: 'white' }} />
                                        </div>
                                        <div>
                                            <div className="text-white font-black text-xl tracking-tight">{s.student.name}</div>
                                            <div className="text-white/70 text-xs font-medium mt-0.5">
                                                {s.student.grade_name || ''} {s.student.class_name && s.student.class_name !== '未分班'
                                                    ? s.student.class_name
                                                    : (s.student.grade_name ? '' : '未分班')}
                                            </div>
                                        </div>
                                    </div>
                                    <RightOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: '18px' }} />
                                </div>

                                {/* Card Bottom */}
                                <div className="p-4 flex items-center justify-between">
                                    <div>
                                        <Text type="secondary" className="text-xs">共 {s.orders.length} 条订单</Text>
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {Array.from(new Set(
                                                s.orders.flatMap((o: any) => o.items.map((i: any) => i.uniform_type))
                                            )).map((t: any) => (
                                                <Tag key={t} className="rounded-full font-medium text-xs border-none bg-blue-50 text-blue-600">
                                                    {typeText[t] || '校服'}
                                                </Tag>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {/* <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">已付款</div>
                                        <div className="text-2xl font-black text-green-600">
                                            {getPaidCount(s.orders)}<span className="text-xs font-medium text-gray-400">/{s.orders.length}</span>
                                        </div> */}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 flex items-center justify-center">
                        <Empty description={<span className="text-gray-400 font-medium">没有找到相关记录</span>} />
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
