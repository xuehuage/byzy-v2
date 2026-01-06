import React, { useState } from 'react'
import { Card, Form, Input, InputNumber, Button, message, Typography, Row, Col } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ExcelUploader from '../components/ExcelUploader'
import type { StudentData } from '../types'
import { importSchoolData } from '../services/api'

const { Title } = Typography

const ImportData: React.FC = () => {
    const [form] = Form.useForm()
    const navigate = useNavigate()
    const [fullData, setFullData] = useState<StudentData[]>([])
    const [loading, setLoading] = useState(false)

    const handleReset = () => {
        form.resetFields()
        setFullData([])
        // For simplicity, we advise reload to clear file input in this version
        message.info('Form reset (Please reload page if you need to clear file input)')
    }

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()
            setLoading(true)

            // Construct payload compatible with backend ImportService
            const payload = {
                schoolName: values.schoolName,
                products: [
                    { type: 0, price: values.priceSummer || 0 },
                    { type: 1, price: values.priceSpring || 0 },
                    { type: 2, price: values.priceWinter || 0 },
                ],
                students: fullData // Can be empty
            }

            console.log('Sending Import Data:', payload)

            const res = await importSchoolData(payload)
            if (res && res.data && res.data.code === 200) {
                message.success('Data imported successfully!')
                navigate('/schools')
            } else {
                message.error(res?.data?.message || 'Import failed')
            }
        } catch (error) {
            console.error('Import Error:', error)
            // Error handling for validation or API
            // message.error('Failed to import data') // Optional: axios interceptor might handle this
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto pb-10">
            <div className="flex justify-between items-center mb-6">
                <Title level={4} className="!mb-0">导入数据</Title>
            </div>

            <Form form={form} layout="vertical">
                {/* Card 1: School Information */}
                <Card title="1. 学校名称" className="shadow-sm rounded-lg">
                    <Form.Item
                        name="schoolName"
                        label="学校名称"
                        rules={[{ required: true, message: '请输入学校名称' }]}
                    >
                        <Input placeholder="Enter school name" size="large" />
                    </Form.Item>
                </Card>

                {/* Card 2: Pricing Configuration (Optional) */}
                <Card title="2. 统一服装价格（可选）" className="shadow-sm rounded-lg mt-6">
                    <Row gutter={24}>
                        <Col span={8}>
                            <Form.Item
                                name="priceSummer"
                                label="夏装价格"
                                initialValue={0}
                            >
                                <InputNumber
                                    prefix="¥"
                                    style={{ width: '100%' }}
                                    size="large"
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="priceSpring"
                                label="春装/秋装价格"
                                initialValue={0}
                            >
                                <InputNumber
                                    prefix="¥"
                                    style={{ width: '100%' }}
                                    size="large"
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="priceWinter"
                                label="冬装价格"
                                initialValue={0}
                            >
                                <InputNumber
                                    prefix="¥"
                                    style={{ width: '100%' }}
                                    size="large"
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                {/* Card 3: Upload */}
                <Card title="3. 上传数据（可选）" className="shadow-sm rounded-lg mt-6">
                    <ExcelUploader
                        onFinish={(data) => setFullData(data)}
                        preview={true}
                    />
                </Card>
            </Form>

            {/* Inline Footer Actions */}
            <div className="flex justify-end gap-4 mt-8">
                <Button onClick={handleReset} size="large">
                    Reset
                </Button>
                <Button type="primary" icon={<SaveOutlined />} size="large" onClick={handleSubmit} loading={loading}>
                    Submit Import
                </Button>
            </div>
        </div>
    )
}

export default ImportData
