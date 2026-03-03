'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPublicSchoolDetail } from '@/api/studentApi';
import { ShoppingCartOutlined, HistoryOutlined } from '@ant-design/icons';
import Footer from '@/components/Footer';

export default function Home({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params);
  const [schoolName, setSchoolName] = useState<string>('学生校服系统');
  const router = useRouter();

  useEffect(() => {
    const fetchSchoolData = async () => {
      try {
        const res = await fetchPublicSchoolDetail(Number(schoolId));
        if (res.code === 200) {
          setSchoolName(res.data.name);
        }
      } catch (error) {
        console.error('获取学校信息失败:', error);
      }
    };
    fetchSchoolData();
  }, [schoolId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16 px-6 text-center shadow-lg">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">{schoolName}</h1>
        <p className="text-blue-100 opacity-90 text-lg">欢迎使用校服在线订购与查询系统</p>
      </div>

      {/* Main Actions */}
      <main className="flex-1 flex flex-col items-center justify-center -mt-8 px-6 pb-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Order Ticket */}
          <button
            onClick={() => router.push(`/${schoolId}/register?type=order`)}
            className="w-full bg-white p-8 rounded-3xl shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all duration-200 border-2 border-transparent hover:border-blue-200"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-3xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <ShoppingCartOutlined />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-800">立即订购</h2>
                <p className="text-gray-500 mt-1">在线选购，支持补单</p>
              </div>
            </div>
            <div className="text-gray-300 group-hover:text-blue-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Query Ticket */}
          <button
            onClick={() => router.push(`/${schoolId}/query`)}
            className="w-full bg-white p-8 rounded-3xl shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all duration-200 border-2 border-transparent hover:border-green-200"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 text-3xl group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
                <HistoryOutlined />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-800">查询订单</h2>
                <p className="text-gray-500 mt-1">查看详情及售后入口</p>
              </div>
            </div>
            <div className="text-gray-300 group-hover:text-green-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Info Card */}
          {/* <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-100 p-5 rounded-2xl text-center">
            <p className="text-sm text-blue-800 leading-relaxed font-medium">
              💡 提示：订购流程已升级，不再收集身份证号，<br />
              使用“姓名+手机号+生日”即可识别身份。
            </p>
          </div> */}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}