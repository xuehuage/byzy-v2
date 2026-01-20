import request from '../utils/request'
import type {
    ApiResponse,
    School,
    SchoolStats,
    ClassEntity,
    OrderListResponse,
    OrderSearchParams,
    OrderUIItem
} from '../types'

// --- API Methods ---

export interface ExportRow {
    className: string
    studentName: string
    idCard: string
    summerQty: number
    springQty: number
    winterQty: number
    totalAmount: number
    status: string
}

export const importSchoolData = (data: any) => {
    return request.post<ApiResponse<any>>('/import', data)
}

export const getSchoolList = () => {
    return request.get<ApiResponse<School[]>>('/schools')
}

export const getSchoolStats = () => {
    return request.get<ApiResponse<SchoolStats[]>>('/schools/stats')
}

export const exportSchoolData = (schoolId: number) => {
    return request.get<ApiResponse<ExportRow[]>>(`/schools/${schoolId}/export`)
}

export const getClassList = (schoolId: number) => {
    return request.get<ApiResponse<ClassEntity[]>>('/classes', {
        params: { schoolId }
    })
}

export const getOrderList = (params: OrderSearchParams) => {
    return request.get<ApiResponse<OrderListResponse>>('/orders', {
        params
    })
}

export const updateOrder = (data: OrderUIItem) => {
    return request.put<ApiResponse<any>>(`/orders/${data.id}`, data)
}

export const createSupplementaryOrder = (data: { idCard: string, summerQty: number, springQty: number, winterQty: number }) => {
    return request.post<ApiResponse<any>>('/orders/supplementary', data)
}

export const deleteOrder = (id: number) => {
    return request.delete<ApiResponse<any>>(`/orders/${id}`)
}
