export interface Student {
    id: number;
    name: string;
    phone: string;
    birthday: string;
    gradeId: number;
    classId?: number;
    grade_name?: string;
    class_name?: string;
}

export interface StudentDetailResponse {
    code: number;
    message: string;
    data: {
        student: Student;
        orders: any[];
    };
}
