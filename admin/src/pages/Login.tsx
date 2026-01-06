import React, { useState, useEffect } from 'react'
import { Form, Input, Button, message, ConfigProvider, Typography } from 'antd'
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../utils/request'
import { useAuthStore } from '../store/authStore'

const { Title, Text } = Typography

const Login: React.FC = () => {
    const navigate = useNavigate()
    const setLogin = useAuthStore((state) => state.setLogin)
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)

    // Redirect if already logged in
    useEffect(() => {
        const token = localStorage.getItem('token')
        if (token) {
            navigate('/schools', { replace: true })
        }
    }, [navigate])

    const onFinish = async (values: any) => {
        setLoading(true)
        try {
            console.log("Submitting login:", values.username)

            const res = await request.post('/auth/login', {
                username: values.username,
                password: values.password,
                twoFactorCode: values.twoFactorCode
            })

            if (res.data && res.data.code === 200) {
                const { token, user } = res.data.data
                setLogin(token, user)
                message.success('登录成功')
                navigate('/schools')
            } else {
                message.error(res.data?.message || '登录失败')
            }
        } catch (error: any) {
            console.error("Login Error:", error)
        } finally {
            setLoading(false)
        }
    }

    const onFinishFailed = (errorInfo: any) => {
        console.log('Failed:', errorInfo)
        message.warning('请检查输入内容是否正确')
    }

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#3b82f6',
                    borderRadius: 10,
                },
            }}
        >
            <div className="min-h-screen flex items-center justify-center bg-slate-50 from-blue-50 to-white bg-gradient-to-br p-4">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="bg-blue-600 p-10 text-center text-white">
                        <Title level={2} style={{ color: 'white', margin: 0, fontWeight: 700 }}>
                            管理员登录
                        </Title>
                    </div>

                    <div className="p-10">
                        <Form
                            form={form}
                            name="login"
                            layout="vertical"
                            size="large"
                            requiredMark={false}
                            onFinish={onFinish}
                            onFinishFailed={onFinishFailed}
                        >
                            <Form.Item
                                name="username"
                                label={<Text strong>用户名</Text>}
                                rules={[{ required: true, message: '请输入用户名' }]}
                                className="mb-6"
                            >
                                <Input
                                    prefix={<UserOutlined className="text-gray-400" />}
                                    placeholder="Username"
                                    className="py-3 rounded-xl border-gray-200"
                                />
                            </Form.Item>

                            <Form.Item
                                name="password"
                                label={<Text strong>密码</Text>}
                                rules={[{ required: true, message: '请输入密码' }]}
                                className="mb-6"
                            >
                                <Input.Password
                                    prefix={<LockOutlined className="text-gray-400" />}
                                    placeholder="Password"
                                    className="py-3 rounded-xl border-gray-200"
                                />
                            </Form.Item>

                            <Form.Item
                                name="twoFactorCode"
                                label={<Text strong>动态验证码</Text>}
                                rules={[
                                    { required: true, message: '请输入 6 位验证码' },
                                    { len: 6, message: '验证码长度必须为 6 位' }
                                ]}
                                className="mb-10"
                            >
                                <Input
                                    prefix={<SafetyCertificateOutlined className="text-gray-400" />}
                                    placeholder="6位数字"
                                    maxLength={6}
                                    className="py-3 rounded-xl border-gray-200 text-center tracking-[0.5em] text-xl font-mono"
                                />
                            </Form.Item>

                            <Form.Item className="mb-0">
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={loading}
                                    block
                                    className="h-14 text-lg font-bold shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 rounded-xl"
                                >
                                    立即登录
                                </Button>
                            </Form.Item>
                        </Form>

                        <div className="mt-10 text-center">
                            <Text type="secondary" className="text-[11px] uppercase tracking-widest font-medium opacity-40">
                                BYZY Systems &copy; {new Date().getFullYear()}
                            </Text>
                        </div>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    )
}

export default Login
