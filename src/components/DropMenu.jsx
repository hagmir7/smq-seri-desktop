import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { Dropdown, Avatar } from 'antd';
import { useNavigate } from 'react-router';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const formatDateTime = (date) =>
    new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);

const DropMenu = ({ appVersion }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60_000); // update every minute
        return () => clearInterval(interval);
    }, []);

    const handleLogout = useCallback(async () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');

        try {
            if (window.electron) {
                await window.electron.logout();
            } else {
                navigate('/login');
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }, [navigate]);

    const items = useMemo(() => {
        const menuItems = [
            {
                key: 'user',
                label: user?.full_name ?? 'SERIEMOBLE',
                disabled: true,
            },
        ];

        if (window.electron && appVersion) {
            menuItems.push({
                key: 'version',
                label: `V${appVersion}`,
                disabled: true,
            });
        }

        menuItems.push({
            key: 'logout',
            label: 'Déconnexion',
            icon: <LogoutOutlined />,
            onClick: handleLogout,
        });

        return menuItems;
    }, [user, appVersion, handleLogout]);

    return (
        <Dropdown menu={{ items }} trigger={['click']}>
            <a
                onClick={(e) => e.preventDefault()}
                className="flex items-center gap-2 cursor-pointer"
            >
                <Avatar icon={<UserOutlined />} size={40} />
                <div className="flex flex-col leading-tight">
                    <span>{user?.full_name ?? 'Guest'}</span>
                    {
                        user?.service ? (<span className="text-xs text-gray-500">{user?.service?.name}</span>)
                        : <span className="text-xs text-gray-500">{formatDateTime(now)}</span>
                    }
                    
                    
                </div>
            </a>
        </Dropdown>
    );
};

export default DropMenu;