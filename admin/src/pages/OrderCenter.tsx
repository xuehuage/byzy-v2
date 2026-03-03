import React, { useEffect, useState } from 'react';
import { Card, Form, Select, Button, Table, Tag, Space, Typography, Input, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { getSchoolList, getOrderList, getClassList } from '../services/api';
import type { School, ClassEntity, OrderUIItem } from '../types';

const { Option } = Select;
const { Text } = Typography;

const OrderCenter: React.FC = () => {
    const [form] = Form.useForm();
    const [schools, setSchools] = useState<School[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [classes, setClasses] = useState<ClassEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [orderList, setOrderList] = useState<OrderUIItem[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<any>(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });

    useEffect(() => {
        fetchSchools();
        // Removed fetchOrders() from here as it's handled by fetchSchools() setting the first school
    }, []);

    const fetchSchools = async () => {
        try {
            const res = await getSchoolList();
            if (res.data.code === 200) {
                const schoolData = res.data.data;
                setSchools(schoolData);
                if (schoolData.length > 0) {
                    const firstSchoolId = schoolData[0].id;
                    form.setFieldsValue({ schoolId: firstSchoolId });
                    handleSchoolChange(firstSchoolId);
                    fetchOrders(1, { schoolId: firstSchoolId });
                }
            }
        } catch (error) {
            console.error("Fetch schools failed", error);
        }
    };

    const handleSchoolChange = (schoolId: number) => {
        form.setFieldsValue({ gradeId: undefined, classId: undefined });
        setClasses([]);
        if (schoolId) {
            const school = schools.find(s => s.id === schoolId);
            setGrades(school?.grades || []);
        } else {
            setGrades([]);
        }
    };

    const handleGradeChange = async (gradeId: number) => {
        form.setFieldsValue({ classId: undefined });
        if (gradeId) {
            try {
                const res = await getClassList({ gradeId });
                if (res.data.code === 200) setClasses(res.data.data);
            } catch (error) {
                message.error('获取班级失败');
            }
        } else {
            setClasses([]);
        }
    };

    const fetchOrders = async (p = pagination.page, overrides?: any) => {
        const values = { ...form.getFieldsValue(), ...overrides };
        if (!values.schoolId || values.schoolId === 'all') {
            setOrderList([]);
            setTotal(0);
            setSummary(null);
            return;
        }
        setLoading(true);
        try {
            const res = await getOrderList({
                page: p,
                pageSize: pagination.pageSize,
                ...values
            });
            if (res.data.code === 200) {
                setOrderList(res.data.data.list.map((o: any) => ({
                    ...o,
                    studentName: o.student?.name || '未知',
                    studentPhone: o.student?.phone || '未知',
                    className: o.student?.class?.name || o.student?.grade?.name || '未分班'
                })));
                setTotal(res.data.data.total);
                setSummary(res.data.data.summary);
            }
        } catch (error) {
            message.error('获取订单列表失败');
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<OrderUIItem> = [
        { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
        { title: '班级', dataIndex: 'className', key: 'className' },
        { title: '学生姓名', dataIndex: 'studentName', key: 'studentName' },
        { title: '手机号', dataIndex: 'studentPhone', key: 'studentPhone' },
        {
            title: '商品项',
            key: 'items',
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    {r.items?.map((item, idx) => (
                        <Text key={idx} type="secondary">
                            {item.product?.name}: {item.size || '未填'} ({item.quantity}套)
                        </Text>
                    ))}
                </Space>
            )
        },
        {
            title: '金额',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            render: (val) => `¥${(val / 100).toFixed(2)}`
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const map: any = {
                    'PENDING': { color: 'orange', text: '待支付' },
                    'PAID': { color: 'green', text: '已支付' },
                    'EXCHANGING': { color: 'blue', text: '申请调换' },
                    'SHIPPED': { color: 'cyan', text: '已发货' },
                    'CANCELLED': { color: 'default', text: '已取消' },
                    'REFUNDING': { color: 'volcano', text: '退款中' },
                    'REFUNDED': { color: 'red', text: '已退款' }
                };
                const config = map[status] || { color: 'default', text: status };
                return <Tag color={config.color}>{config.text}</Tag>;
            }
        }
    ];

    return (
        <div className="p-6 bg-white shadow-sm rounded-lg min-h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">订单管理</h1>
                    <p className="text-gray-500 mt-1">
                        {summary ? (
                            summary.studentName ? (
                                <Text type="secondary">
                                    {summary.schoolName || ''} {summary.className || ''} {summary.studentName} 共 {summary.summerQty}套夏装，{summary.autumnQty}套秋装，{summary.winterQty}套冬装，总金额 ¥{(summary.totalRevenue / 100).toFixed(2)}
                                </Text>
                            ) : (
                                <Text type="secondary">
                                    {summary.schoolName || '全校'} {summary.className || ''} 共 {summary.summerQty}套夏装，{summary.autumnQty}套秋装，{summary.winterQty}套冬装，总金额 ¥{(summary.totalRevenue / 100).toFixed(2)}
                                </Text>
                            )
                        ) : (
                            "正在加载统计信息..."
                        )}
                    </p>
                </div>
            </div>

            <Card className="mb-6 bg-gray-50 border-none">
                <Form form={form} layout="vertical" onFinish={() => { setPagination({ ...pagination, page: 1 }); fetchOrders(1); }}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <Form.Item label="学校" name="schoolId" className="!mb-0">
                            <Select placeholder="选择学校" allowClear onChange={handleSchoolChange}>
                                {schools.map(school => (
                                    <Option key={school.id} value={school.id}>{school.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label="年级" name="gradeId" className="!mb-0">
                            <Select
                                placeholder="选择年级"
                                onChange={handleGradeChange}
                                allowClear
                                disabled={!grades.length}
                            >
                                <Option key="all" value="all">全部</Option>
                                {grades.map(grade => (
                                    <Option key={grade.id} value={grade.id}>{grade.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label="班级" name="classId" className="!mb-0">
                            <Select
                                placeholder="选择班级"
                                allowClear
                                disabled={!classes.length}
                            >
                                <Option key="all" value="all">全部</Option>
                                {classes.map(cls => (
                                    <Option key={cls.id} value={cls.id}>{cls.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="status" label="状态" className="!mb-0">
                            <Select placeholder="不限" allowClear>
                                <Option value="PENDING">待支付</Option>
                                <Option value="PAID">已支付</Option>
                                <Option value="EXCHANGING">申请调换</Option>
                                <Option value="SHIPPED">已发货</Option>
                                <Option value="REFUNDING">退款中</Option>
                                <Option value="REFUNDED">已退款</Option>
                            </Select>
                        </Form.Item>
                    </div>
                    <div className="flex justify-between items-end">
                        <Form.Item name="keyword" label="搜索" className=" !mb-0 mr-4">
                            <Input placeholder="姓名/手机号/订单号/身份证" allowClear prefix={<SearchOutlined className="text-gray-400 " />} className='w-60' />
                        </Form.Item>
                        <Form.Item className="!mb-0">
                            <Space>
                                <Button type="primary" icon={<SearchOutlined />} htmlType="submit">查询</Button>
                                <Button icon={<ReloadOutlined />} onClick={() => {
                                    form.resetFields();
                                    setGrades([]);
                                    setClasses([]);
                                    if (schools.length > 0) {
                                        const firstSchoolId = schools[0].id;
                                        form.setFieldsValue({ schoolId: firstSchoolId, gradeId: undefined, classId: undefined });
                                        handleSchoolChange(firstSchoolId);
                                        fetchOrders(1, { schoolId: firstSchoolId });
                                    } else {
                                        fetchOrders(1);
                                    }
                                }}>重置</Button>
                            </Space>
                        </Form.Item>
                    </div>
                </Form>
            </Card>

            <Table
                columns={columns}
                dataSource={orderList}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: pagination.page,
                    pageSize: pagination.pageSize,
                    total: total,
                    onChange: (p) => { setPagination({ ...pagination, page: p }); fetchOrders(p); }
                }}
            />
        </div>
    );
};

export default OrderCenter;
