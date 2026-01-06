import React from 'react'
import { Layout, Menu, Avatar, Dropdown, theme } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
    DashboardOutlined,
    HomeOutlined,
    ShoppingOutlined,
    UserOutlined,
    LogoutOutlined,
    DatabaseOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../store/authStore'

const { Header, Sider, Content } = Layout

const AdminLayout: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuthStore()

    const {
        token: { colorBgContainer },
    } = theme.useToken()

    const handleLogout = () => {
        logout()
        navigate('/byzy-admin')
    }

    const menuItems = [
        {
            key: '/',
            icon: <DashboardOutlined />,
            label: 'dashboard',
            onClick: () => navigate('/'),
        },
        {
            key: '/schools',
            icon: <HomeOutlined />,
            label: '学校列表',
            onClick: () => navigate('/schools'),
        },
        {
            key: '/orders',
            icon: <ShoppingOutlined />,
            label: '订单管理',
            onClick: () => navigate('/orders'),
        },
        {
            key: '/import',
            icon: <DatabaseOutlined />,
            label: '数据导入',
            onClick: () => navigate('/import'),
        },
    ]

    const userMenu = {
        items: [
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Logout',
                onClick: handleLogout,
            },
        ],
    }

    return (
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
            <Sider width={250} theme="dark" className="shadow-lg">
                <div className="h-16 flex items-center justify-center border-b border-gray-700">
                    <h1 className="text-white text-xl font-bold tracking-wider">BYZY Admin</h1>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    className="mt-4 border-r-0"
                />
            </Sider>
            <Layout>
                <Header style={{ background: colorBgContainer, padding: 0 }} className="flex justify-end items-center px-6 shadow-sm z-10">
                    <Dropdown menu={userMenu} placement="bottomRight">
                        <div className="flex items-center cursor-pointer hover:bg-gray-50 px-3 py-1 rounded transition-colors mr-6">
                            <Avatar icon={<UserOutlined />} className="bg-blue-500 mr-2" />
                            <span className="font-medium text-gray-700">{user?.username || 'Admin'}</span>
                        </div>
                    </Dropdown>
                </Header>
                <Content style={{ margin: '16px', overflowY: 'auto', height: '100%' }}>
                    <div style={{ padding: 24, minHeight: 360 }}>
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}

export default AdminLayout
