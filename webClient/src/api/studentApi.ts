import { StudentDetailResponse } from '@/types/student.types';
import axiosInstance from 'src/utils/axiosInstance';

/**
 * 根据身份证号查询学生详情
 * @param idCard 学生身份证号
 * @returns 学生详情数据
 */
export const fetchStudentDetail = async (idCard: string, schoolId?: number): Promise<StudentDetailResponse> => {
    const response = await axiosInstance.get(`/public/students/query-by-idcard/${idCard}`, {
        params: { schoolId }
    });
    const { data } = response;

    if (data.code !== 200) {
        throw new Error(data.message || '查询学生信息失败');
    }

    return data;
};

/**
 * 根据 姓名+手机+生日 查询学生详情 (V2)
 */
export const fetchStudentDetailV2 = async (name: string, phone: string, birthday: string, schoolId: number): Promise<StudentDetailResponse> => {
    const response = await axiosInstance.get('/public/students/query', {
        params: { name, phone, birthday, schoolId }
    });
    const { data } = response;

    if (data.code !== 200) {
        throw new Error(data.message || '查询学生信息失败');
    }

    return data;
};

/**
 * 创建新订单 (V2)
 */
export const createOrderV2 = async (payload: any) => {
    const response = await axiosInstance.post('/public/order/v2', payload);
    return response.data;
};

/**
 * 根据手机号查询所有关联学生（支持一个手机号多个孩子）
 */
export const fetchStudentsByPhone = async (phone: string, schoolId?: number): Promise<any> => {
    const response = await axiosInstance.get('/public/students/query-by-phone', {
        params: { phone, schoolId }
    });
    const { data } = response;
    if (data.code !== 200) {
        throw new Error(data.message || '查询失败');
    }
    return data;
};

/**
 * 根据学生 ID 查询学生详情 (V2)
 */
export const fetchStudentDetailById = async (id: number, schoolId?: number): Promise<StudentDetailResponse> => {
    const response = await axiosInstance.get(`/public/student/${id}`, {
        params: { schoolId }
    });
    const { data } = response;

    if (data.code !== 200) {
        throw new Error(data.message || '查询学生信息失败');
    }

    return data;
};

/**
 * 获取学校基本信息
 */
export const fetchPublicSchoolDetail = async (id: number) => {
    const response = await axiosInstance.get(`/public/school/${id}`);
    return response.data;
};

/**
 * 获取临时订单详情 (V2)
 */
export const fetchTempOrder = async (id: number) => {
    const response = await axiosInstance.get(`/public/temp-order/${id}`);
    return response.data;
};


// // 可添加其他学生相关API
// export const fetchStudentOrders = async (studentId: string) => {
//     const response = await axiosInstance.get(`/student/orders?studentId=${studentId}`);
//     return response.data;
// };