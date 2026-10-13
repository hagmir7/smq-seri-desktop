import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
    Form,
    Input,
    Button,
    Alert,
    Typography,
    Modal,
    AutoComplete,
    Badge,
} from 'antd';

import {
    UserOutlined,
    LockOutlined,
} from '@ant-design/icons';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import Connection from '../components/Connection';
import { Link } from 'lucide-react';
import TitleBar from '../components/TitleBar';

const { Title, Text } = Typography;

// Default connection
const DEFAULT_CONNECTION = 'http://192.168.1.38:60/api/';

const Login = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const { login, loading, message } = useAuth();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [usernames, setUsernames] = useState([]);
    const [appVersion, setAppVersion] = useState('');
    const [errorType, setErrorType] = useState(null);

    // Get Electron app version
    useEffect(() => {
        if (window.electron?.getVersion) {
            window.electron.getVersion().then(setAppVersion);
        }
    }, []);

    // Load saved usernames
    useEffect(() => {
        const saved = JSON.parse(
            localStorage.getItem('usernames') || '[]'
        );

        setUsernames(saved);
    }, []);

    // Initialize default connection + form + auth check
    useEffect(() => {
        // If no connection has been configured,
        // use Local as the default connection.
        if (!localStorage.getItem('connection_url')) {
            localStorage.setItem(
                'connection_url',
                DEFAULT_CONNECTION
            );
        }

        form.setFieldsValue({
            login:
                import.meta.env.MODE === 'development'
                    ? 'admin@admin.com'
                    : '',

            password:
                import.meta.env.MODE === 'development'
                    ? 'password'
                    : '',
        });

        checkAuth();
    }, [form]);

    // Submit login
    const handleSubmit = async (values) => {
        try {
            setErrorType(null);

            await login(values);

            const token = localStorage.getItem('authToken');

            if (!token) {
                setErrorType('auth');
                return;
            }

            // Save username
            const updated = Array.from(
                new Set([
                    values.login,
                    ...usernames,
                ])
            );

            localStorage.setItem(
                'usernames',
                JSON.stringify(updated)
            );

            setUsernames(updated);
        } catch (error) {
            console.error('Login error:', error);

            if (
                error?.message?.includes('Network') ||
                error?.code === 'ERR_NETWORK' ||
                error?.code === 'ECONNREFUSED' ||
                !navigator.onLine
            ) {
                setErrorType('network');
            } else {
                setErrorType('auth');
            }
        }
    };

    // Automatically login if token already exists
    const checkAuth = async () => {
        const token = localStorage.getItem('authToken');

        if (!token) {
            return;
        }

        try {
            const response = await api.get('user', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (window.electron) {
                await window.electron.user({
                    user: response.data,
                    access_token: token,
                });
            } else {
                navigate('/');
            }
        } catch (error) {
            // Silent fail for automatic authentication
            console.error('Auth check failed:', error);

            // Remove invalid token
            localStorage.removeItem('authToken');
        }
    };

    // Error message
    const getErrorMessage = () => {
        if (errorType === 'network') {
            return (
                <div>
                    <div className="font-semibold mb-1">
                        Erreur de connexion réseau
                    </div>

                    <div className="text-sm opacity-90">
                        Impossible de se connecter au serveur.
                        Veuillez vérifier votre connexion ou
                        changer le type de connexion.
                    </div>
                </div>
            );
        }

        return message;
    };

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0d3b2e] flex flex-col">

            {/* Title bar */}
            <TitleBar title="SMQ Pro — Connexion" />

            {/* Main content */}
            <div className="relative flex-1 w-full flex items-center justify-center">

                {/* Background gradient */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(circle at 15% 20%, rgba(74, 222, 128, 0.18), transparent 45%), radial-gradient(circle at 85% 80%, rgba(16, 185, 129, 0.20), transparent 50%), linear-gradient(160deg, #0d3b2e 0%, #114b3a 45%, #1a5c46 100%)',
                    }}
                />

                {/* Background pattern */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.06]"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 22px)',
                    }}
                />

                {/* Login container */}
                <div className="relative w-full sm:max-w-md md:max-w-lg px-6 py-10 sm:px-10">

                    {/* Logo + title */}
                    <div className="relative z-10 text-center mb-8">

                        <img
                            className="h-14 mx-auto mb-5"
                            src="https://app.intercocina.com/assets/imgs/intercocina-logo.png"
                            alt="Intercocina"
                        />

                        <Title
                            level={4}
                            className="!mb-1 !text-white mt-0 pt-0"
                        >
                            Connectez-vous
                        </Title>

                        <Text className="text-emerald-100">
                            Entrez vos identifiants pour accéder à votre compte.
                        </Text>
                    </div>

                    {/* Error */}
                    {(message || errorType === 'network') && (
                        <Alert
                            message={getErrorMessage()}
                            type={
                                errorType === 'network'
                                    ? 'warning'
                                    : 'error'
                            }
                            showIcon
                            className="relative z-10 mb-6 rounded-lg"
                            action={
                                errorType === 'network' && (
                                    <Button
                                        size="small"
                                        type="link"
                                        onClick={() =>
                                            setIsModalOpen(true)
                                        }
                                        className="text-emerald-800 hover:!text-emerald-900 whitespace-nowrap"
                                    >
                                        Changer la connexion
                                    </Button>
                                )
                            }
                        />
                    )}

                    {/* Login form */}
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                        requiredMark={false}
                        className="relative z-10"
                    >

                        {/* Login */}
                        <Form.Item
                            name="login"
                            label={
                                <span className="font-medium text-emerald-50">
                                    E-mail ou Matricule
                                </span>
                            }
                            rules={[
                                {
                                    required: true,
                                    message:
                                        'Veuillez entrer votre identifiant',
                                },
                            ]}
                        >
                            <AutoComplete
                                options={usernames.map((username) => ({
                                    value: username,
                                }))}
                                placeholder="Entrez votre identifiant"
                                size="large"
                                className="w-full"
                            >
                                <Input
                                    prefix={
                                        <UserOutlined className="text-emerald-600" />
                                    }
                                    size="large"
                                    className="rounded-lg bg-white/95"
                                />
                            </AutoComplete>
                        </Form.Item>

                        {/* Password */}
                        <Form.Item
                            name="password"
                            label={
                                <span className="font-medium text-emerald-50">
                                    Mot de passe
                                </span>
                            }
                            rules={[
                                {
                                    required: true,
                                    message:
                                        'Veuillez entrer votre mot de passe',
                                },
                            ]}
                        >
                            <Input.Password
                                prefix={
                                    <LockOutlined className="text-emerald-600" />
                                }
                                placeholder="Entrez votre mot de passe"
                                size="large"
                                className="rounded-lg bg-white/95"
                            />
                        </Form.Item>

                        {/* Login button */}
                        <Form.Item className="mt-6 mb-2">
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                block
                                size="middle"
                                className="bg-white !text-emerald-800 hover:!bg-emerald-50 border-none rounded-lg h-9 font-semibold shadow-sm"
                            >
                                {loading
                                    ? 'Connexion...'
                                    : 'Se connecter'}
                            </Button>
                        </Form.Item>
                    </Form>

                    {/* Connection configuration */}
                    <div className="relative z-10 mt-6 flex items-center justify-center">

                        <Button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-white/10 border-white/20 text-emerald-50 hover:!text-white hover:!border-white/40 hover:!bg-white/15"
                        >
                            <Link size={16} />

                            <span className="text-sm">
                                Configurer la connexion
                            </span>
                        </Button>

                    </div>

                    {/* App version */}
                    {window.electron && (
                        <div className="flex w-full justify-center">

                            <Badge
                                className="relative z-10 text-center font-bold mt-6 text-xs text-white leading-4"
                            >
                                v{appVersion}
                            </Badge>

                        </div>
                    )}
                </div>
            </div>

            {/* Connection modal */}
            <Modal
                title="Type de connexion"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={false}
                width="90%"
                style={{
                    maxWidth: 480,
                }}
            >
                <Connection />
            </Modal>
        </div>
    );
};

export default Login;