'use client';

import { useState, use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Form, Typography, Card } from 'antd';
import { DatePicker as MobileDatePicker, Picker } from 'antd-mobile';
import { UserOutlined, PhoneOutlined, CalendarOutlined, ArrowLeftOutlined, ClusterOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Footer from '@/components/Footer';
import { fetchPublicSchoolDetail } from '@/api/studentApi';

const { Title, Text } = Typography;

export default function RegisterPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const type = searchParams.get('type') || 'order'; // 'order' or 'query'

    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [gradePickerVisible, setGradePickerVisible] = useState(false);
    const [classPickerVisible, setClassPickerVisible] = useState(false);

    const [schoolData, setSchoolData] = useState<any>(null);
    const [grades, setGrades] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);

    const birthdayValue = Form.useWatch('birthday', form);
    const gradeId = Form.useWatch('gradeId', form);
    const classId = Form.useWatch('classId', form);

    useEffect(() => {
        const loadSchoolData = async () => {
            try {
                const res = await fetchPublicSchoolDetail(Number(schoolId));
                if (res.code === 200) {
                    setSchoolData(res.data);
                    setGrades(res.data.grades || []);
                }
            } catch (err) {
                console.error('Failed to load school data', err);
            }
        };
        loadSchoolData();
    }, [schoolId]);

    // Update classes when grade changes
    useEffect(() => {
        if (gradeId) {
            const selectedGrade = grades.find(g => g.id === gradeId);
            setClasses(selectedGrade?.classes || []);
            // Only reset classId if it's not currently valid for the new grade
            const isValidClass = selectedGrade?.classes?.some((c: any) => c.id === classId);
            if (!isValidClass) {
                form.setFieldsValue({ classId: undefined });
            }
        } else {
            setClasses([]);
            form.setFieldsValue({ classId: undefined });
        }
    }, [gradeId, grades, form]);

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            const birthday = typeof values.birthday === 'string' ? values.birthday : values.birthday.format('YYYY-MM-DD');
            let queryString = `name=${encodeURIComponent(values.name)}&phone=${values.phone}&birthday=${birthday}`;

            if (values.gradeId) queryString += `&gradeId=${values.gradeId}`;
            if (values.classId) queryString += `&classId=${values.classId}`;

            if (type === 'order') {
                router.push(`/${schoolId}/order?${queryString}`);
            } else {
                router.push(`/${schoolId}/query?${queryString}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const gradeOptions = grades.map(g => ({ label: g.name, value: g.id }));
    const classOptions = classes.map(c => ({ label: c.name, value: c.id }));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white px-6 py-4 flex items-center border-b sticky top-0 z-10">
                <button onClick={() => router.back()} className="mr-4 text-gray-600 hover:text-blue-600 transition-colors">
                    <ArrowLeftOutlined style={{ fontSize: '20px' }} />
                </button>
                <Title level={4} style={{ margin: 0, fontSize: '18px' }}>
                    {type === 'order' ? '填写订购信息' : '填写查询信息'}
                </Title>
            </div>

            <main className="flex-1 p-6 flex flex-col items-center">
                <Card
                    className="w-full max-w-md shadow-lg rounded-3xl overflow-hidden border-none"
                    bodyStyle={{ padding: '32px 24px' }}
                >
                    <div className="text-center mb-10">
                        <Title level={3} style={{ marginBottom: '8px' }}>填写信息</Title>
                    </div>

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={onFinish}
                        size="large"
                        requiredMark={false}
                    >
                        {grades.length > 0 && (
                            <Form.Item
                                name="gradeId"
                                label={<span className="font-semibold text-gray-700">年级</span>}
                                rules={[{ required: true, message: '请选择年级' }]}
                            >
                                <div className="relative cursor-pointer" onClick={() => setGradePickerVisible(true)}>
                                    <Input
                                        prefix={<ClusterOutlined className="text-gray-400 mr-2" />}
                                        placeholder="请选择年级"
                                        value={grades.find(g => g.id === gradeId)?.name}
                                        readOnly
                                        className="rounded-xl border-gray-200 py-3 pointer-events-none"
                                    />
                                    <Picker
                                        columns={[gradeOptions]}
                                        visible={gradePickerVisible}
                                        onClose={() => setGradePickerVisible(false)}
                                        onConfirm={(val) => {
                                            form.setFieldsValue({ gradeId: val[0] });
                                        }}
                                    />
                                </div>
                            </Form.Item>
                        )}

                        {classes.length > 0 && (
                            <Form.Item
                                name="classId"
                                label={<span className="font-semibold text-gray-700">班级</span>}
                                rules={[{ required: true, message: '请选择班级' }]}
                            >
                                <div className="relative cursor-pointer" onClick={() => setClassPickerVisible(true)}>
                                    <Input
                                        prefix={<TeamOutlined className="text-gray-400 mr-2" />}
                                        placeholder="请选择班级"
                                        value={classes.find(c => c.id === classId)?.name}
                                        readOnly
                                        className="rounded-xl border-gray-200 py-3 pointer-events-none"
                                    />
                                    <Picker
                                        columns={[classOptions]}
                                        visible={classPickerVisible}
                                        onClose={() => setClassPickerVisible(false)}
                                        onConfirm={(val) => {
                                            form.setFieldsValue({ classId: val[0] });
                                        }}
                                    />
                                </div>
                            </Form.Item>
                        )}

                        <Form.Item
                            name="name"
                            label={<span className="font-semibold text-gray-700">学生姓名</span>}
                            rules={[{ required: true, message: '请输入学生姓名' }]}
                        >
                            <Input
                                prefix={<UserOutlined className="text-gray-400 mr-2" />}
                                placeholder="请输入姓名 (无空格)"
                                className="rounded-xl border-gray-200"
                            />
                        </Form.Item>

                        <Form.Item
                            name="phone"
                            label={<span className="font-semibold text-gray-700">预留手机号</span>}
                            rules={[
                                { required: true, message: '请输入手机号' },
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
                            ]}
                        >
                            <Input
                                prefix={<PhoneOutlined className="text-gray-400 mr-2" />}
                                placeholder="请输入11位手机号"
                                className="rounded-xl border-gray-200"
                            />
                        </Form.Item>

                        <Form.Item
                            name="birthday"
                            label={<span className="font-semibold text-gray-700">出生日期</span>}
                            rules={[{ required: true, message: '请选择出生日期' }]}
                        >
                            <div
                                className="relative cursor-pointer"
                                onClick={() => setPickerVisible(true)}
                            >
                                <Input
                                    prefix={<CalendarOutlined className="text-gray-400 mr-2" />}
                                    placeholder="请选择学生生日"
                                    value={birthdayValue}
                                    readOnly
                                    className="rounded-xl border-gray-200 py-3 pointer-events-none"
                                />
                                <MobileDatePicker
                                    title='选择出生日期'
                                    visible={pickerVisible}
                                    onClose={() => setPickerVisible(false)}
                                    max={new Date()}
                                    onConfirm={val => {
                                        form.setFieldsValue({ birthday: dayjs(val).format('YYYY-MM-DD') });
                                    }}
                                />
                            </div>
                        </Form.Item>

                        <div className="mt-10">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                className={`h-14 rounded-2xl text-lg font-bold shadow-lg border-none ${type === 'order' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                下一步
                            </Button>
                        </div>
                    </Form>

                    <div className="mt-8 text-center px-4">
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                            身份信息将用于匹配现有订单或创建新订购档案，请确保填写准确。
                        </Text>
                    </div>
                </Card>
            </main>

            <Footer />
        </div>
    );
}
