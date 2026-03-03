export interface StudentData {
    className: string
    studentName: string
    idCard: string
    summerQty: number
    springQty: number
    winterQty: number
}

export interface SchoolDataType {
    id: number
    name: string
    student_count: number
    total_revenue: number
    status: 0 | 1 // 0: Inactive, 1: Active
    created_at: string
}

export interface SchoolConfig {
    summerImage: string | null
    autumnImage: string | null
    winterImage: string | null
    sizeGuideImage: string | null
    isSummerActive: boolean
    isAutumnActive: boolean
    isWinterActive: boolean
    summerPrice?: number
    autumnPrice?: number
    winterPrice?: number
}

export interface AfterSalesRecord {
    id: number
    orderId: number
    type: 'EXCHANGE' | 'REFUND'
    status: 'PENDING' | 'PROCESSED' | 'REJECTED'
    originalQuantity: number
    originalSize: string
    newQuantity: number
    newSize: string | null
    createdAt: string
    order?: Order
}

// --- API Types ---

// 1. Generic API Response Wrapper
export interface ApiResponse<T = any> {
    code: number
    message?: string
    data: T
}

export interface SchoolStats {
    id: number
    name: string
    status: number
    createdAt: string
    studentCount: number
    summerQty: number
    springQty: number
    winterQty: number
    totalRevenue: number
    paidAmount: number
    unpaidAmount: number
    summerImage?: string | null
    autumnImage?: string | null
    winterImage?: string | null
    sizeGuideImage?: string | null
    isSummerActive?: boolean
    isAutumnActive?: boolean
    isWinterActive?: boolean
    summerPrice?: number
    autumnPrice?: number
    winterPrice?: number
}

export interface School {
    id: number
    name: string
    status: number
    createdAt: string
    classes?: ClassEntity[]
    updatedAt: string
    studentCount?: number
}

export interface ClassEntity {
    id: number
    schoolId: number
    name: string
    createdAt: string
    studentCount?: number
}

export interface Order {
    id: number
    studentId: number
    orderNo: string
    totalAmount: number
    status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDING' | 'REFUNDED'
    createdAt: string
    student?: {
        name: string
        idCard: string
        class?: {
            name: string
            school?: {
                name: string
            }
        }
    }
    afterSales?: any[]
    items?: any[]
    [key: string]: any
}

// 2. Search Params for Order API
export interface OrderSearchParams {
    page: number
    pageSize: number
    schoolId?: number
    classId?: number
    status?: string
    keyword?: string
}

export interface OrderSummary {
    totalRevenue: number
    summerQty: number
    springQty: number
    winterQty: number
    schoolName?: string
    className?: string
    studentName?: string
}

export interface OrderListResponse {
    list: Order[]
    total: number
    page: number
    pageSize: number
    summary?: OrderSummary
}

export interface OrderUIItem extends Order {
    className: string
    studentName: string
    summerQty: number
    springQty: number
    winterQty: number
}
