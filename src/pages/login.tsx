import Image from "next/image";
import Link from "next/link";
import { type ReactElement } from "react";
import { AuthLayout } from "~/components/AuthLayout";
import { UserAuthForm } from "~/components/UserAuthForm";
import { type NextPageWithLayout } from "./_app";

const LoginPage: NextPageWithLayout = () => {
  return (
    <>
      <div className="flex flex-col">
        <Link
          href="/"
          className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
        >
          <Image
            width={40}
            height={40}
            src="https://cdn.builder.io/api/v1/image/assets/TEMP/cf51d4614b9df3de0b1afa110d29f9e9e58cabc5721e8169aaf817138c300f87?apiKey=b4b8e1120d4040cb8e27288270221f30&width=2000"
            alt="HasCode UI"
            className="h-8 w-auto"
          />
          <p className=" text-xl font-bold text-gray-700">HasCode UI</p>
        </Link>
        <div className="mt-20">
          <h2 className="text-lg font-semibold text-gray-900">
            Sign in to your account
          </h2>
        </div>
      </div>
      <UserAuthForm />
    </>
  );
};

LoginPage.getLayout = (page: ReactElement) => (
  <AuthLayout title="Login">{page}</AuthLayout>
);

export default LoginPage;
