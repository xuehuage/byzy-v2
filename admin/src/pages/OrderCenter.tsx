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
    const [classes, setClasses] = useState<ClassEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [orderList, setOrderList] = useState<OrderUIItem[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<any>(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });

    useEffect(() => {
        fetchSchools();
        fetchOrders();
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

    const handleSchoolChange = async (value: number) => {
        form.setFieldsValue({ classId: undefined });
        if (value) {
            try {
                const res = await getClassList(value);
                if (res.data.code === 200) setClasses(res.data.data);
            } catch (error) {
                message.error('获取班级失败');
            }
        } else {
            setClasses([]);
        }
    };

    const fetchOrders = async (p = pagination.page, overrides?: any) => {
        setLoading(true);
        try {
            const values = { ...form.getFieldsValue(), ...overrides };
            const res = await getOrderList({
                page: p,
                pageSize: pagination.pageSize,
                ...values
            });
            if (res.data.code === 200) {
                setOrderList(res.data.data.list.map((o: any) => ({
                    ...o,
                    studentName: o.student?.name,
                    studentPhone: o.student?.phone,
                    className: o.student?.class?.name
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
                            {item.product?.name}: {item.size || '未填'} ({item.quantity}件)
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
                                    {summary.schoolName || ''} {summary.className || ''} {summary.studentName} 共 {summary.summerQty}套夏装，{summary.springQty}套秋装，{summary.winterQty}套冬装，总金额 ¥{(summary.totalRevenue / 100).toFixed(2)}
                                </Text>
                            ) : (
                                <Text type="secondary">
                                    {summary.schoolName || '全校'} {summary.className || ''} 共 {summary.summerQty}套夏装，{summary.springQty}套秋装，{summary.winterQty}套冬装，总金额 ¥{(summary.totalRevenue / 100).toFixed(2)}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Form.Item name="schoolId" label="学校" className="!mb-0">
                            <Select placeholder="全选" allowClear onChange={handleSchoolChange}>
                                {schools.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="classId" label="班级" className="!mb-0">
                            <Select placeholder="选择班级" allowClear disabled={!classes.length}>
                                {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
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
                                    setClasses([]);
                                    if (schools.length > 0) {
                                        const firstSchoolId = schools[0].id;
                                        form.setFieldsValue({ schoolId: firstSchoolId });
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
