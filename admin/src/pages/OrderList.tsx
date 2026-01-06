import React, { useEffect, useState } from 'react'
import { Card, Form, Select, Button, Table, Tag, Space, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { getSchoolList, getOrderList } from '../services/api'
import type { Order, School } from '../types'

const { Option } = Select
const { Title } = Typography

interface OrderUIItem extends Order {
    className: string
    studentName: string
    summerQty: number
    springQty: number
    winterQty: number
}

const OrderList: React.FC = () => {
    const [form] = Form.useForm()
    const [schools, setSchools] = useState<School[]>([])
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
    const [loading, setLoading] = useState(false)
    const [orderList, setOrderList] = useState<OrderUIItem[]>([])
    const [total, setTotal] = useState(0)
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

    useEffect(() => {
        fetchSchools()
    }, [])

    const fetchSchools = async () => {
        try {
            const res = await getSchoolList()
            if (res.data.code === 200) {
                setSchools(res.data.data)
            }
        } catch (error) {
            console.error("Fetch schools failed", error)
        }
    }

    const fetchOrders = async (values?: any) => {
        setLoading(true)
        try {
            const currentValues = values || form.getFieldsValue()
            const params = {
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...currentValues
            }

            // Clean up 'all' values
            Object.keys(params).forEach(key => {
                if (params[key] === 'all') params[key] = undefined
            })

            const res = await getOrderList(params)
            if (res.data && res.data.code === 200) {
                const { list, total: totalCount } = res.data.data
                const uiItems: OrderUIItem[] = list.map((order: any) => ({
                    ...order,
                    className: order.student?.class?.name || 'Unknown',
                    studentName: order.student?.name || 'Unknown',
                    // summerQty/springQty/winterQty are already pre-calculated by backend now
                }))
                setOrderList(uiItems)
                setTotal(totalCount)
            }
        } catch (error) {
            console.error("Fetch orders failed", error)
            message.error("获取订单列表失败")
        } finally {
            setLoading(false)
        }
    }

    const handleSchoolChange = (value: number | string) => {
        if (value === 'all') {
            setSelectedSchool(null)
        } else {
            const school = schools.find(s => s.id === value)
            setSelectedSchool(school || null)
        }
        form.setFieldsValue({ classId: 'all' })
    }

    const handleSearch = (values: any) => {
        if (pagination.page !== 1) {
            setPagination({ ...pagination, page: 1 })
            // fetchOrders will be called by the other useEffect when page changes to 1
        } else {
            fetchOrders(values)
        }
    }

    const handleReset = () => {
        form.resetFields()
        setSelectedSchool(null)
        setOrderList([])
        setTotal(0)
        setPagination({ ...pagination, page: 1 })
    }

    // Add this to handle pagination changes after search
    useEffect(() => {
        // If we have data or have interacted, fetch on page change
        if (orderList.length > 0 || total > 0) { // Check total > 0 to handle cases where orderList might be empty but total is not (e.g., filtering to no results)
            fetchOrders()
        }
    }, [pagination.page, pagination.pageSize])

    const columns: ColumnsType<OrderUIItem> = [
        {
            title: '班级',
            dataIndex: 'className',
            key: 'className',
        },
        {
            title: '姓名',
            dataIndex: 'studentName',
            key: 'studentName',
            render: (text) => <span className="font-medium">{text}</span>,
        },
        {
            title: '夏装套数',
            dataIndex: 'summerQty',
            key: 'summerQty',
            align: 'center',
            render: (val) => val || 0
        },
        {
            title: '春秋装套数',
            dataIndex: 'springQty',
            key: 'springQty',
            align: 'center',
            render: (val) => val || 0
        },
        {
            title: '冬装套数',
            dataIndex: 'winterQty',
            key: 'winterQty',
            align: 'center',
            render: (val) => val || 0
        },
        {
            title: '总金额',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            render: (amount) => `¥ ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            align: 'right',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default'
                let text = status
                switch (status.toUpperCase()) {
                    case 'PENDING':
                        color = 'orange'
                        text = '待支付'
                        break
                    case 'PAID':
                        color = 'green'
                        text = '已支付'
                        break
                    case 'CANCELLED':
                        color = 'red'
                        text = '已取消'
                        break
                }
                return <Tag color={color}>{text}</Tag>
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="link" size="small">查看详情</Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Title level={4} className="!mb-0">订单管理</Title>
            </div>

            {/* Filter Section */}
            <Card bordered={false} className="shadow-sm rounded-lg">
                <Form form={form} layout="inline" className="gap-y-4" onFinish={handleSearch} initialValues={{ schoolId: 'all', classId: 'all', uniformType: 'all', status: 'all' }}>
                    <Form.Item label="学校" name="schoolId" className="min-w-[200px]">
                        <Select
                            placeholder="Select School"
                            onChange={handleSchoolChange}
                        >
                            <Option key="all" value="all">全部</Option>
                            {schools.map(school => (
                                <Option key={school.id} value={school.id}>{school.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label="班级" name="classId" className="min-w-[150px]">
                        <Select
                            placeholder="Select Class"
                            disabled={!selectedSchool}
                        >
                            <Option key="all" value="all">全部</Option>
                            {selectedSchool?.classes?.map(cls => (
                                <Option key={cls.id} value={cls.id}>{cls.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label="类型" name="uniformType" className="min-w-[150px]">
                        <Select placeholder="Uniform Type">
                            <Option key="all" value="all">全部</Option>
                            <Option value="summer">夏装</Option>
                            <Option value="spring_autumn">春装/秋装</Option>
                            <Option value="winter">冬装</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="状态" name="status" className="min-w-[150px]">
                        <Select placeholder="Status">
                            <Option key="all" value="all">全部</Option>
                            <Option value="PENDING">待支付</Option>
                            <Option value="PAID">已支付</Option>
                            <Option value="CANCELLED">已取消</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                                搜索
                            </Button>
                            <Button onClick={handleReset} icon={<ReloadOutlined />}>
                                重置
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            {/* Data Table */}
            <Card bordered={false} className="shadow-sm rounded-lg" bodyStyle={{ padding: 0 }}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={orderList}
                    loading={loading}
                    pagination={{
                        current: pagination.page,
                        pageSize: pagination.pageSize,
                        total: total,
                        onChange: (page, pageSize) => setPagination({ page, pageSize }),
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                        position: ['bottomCenter'],
                    }}
                />
            </Card>
        </div>
    )
}

export default OrderList
