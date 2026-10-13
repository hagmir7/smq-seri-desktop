import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import UpdateNotifier from '../components/UpdateNotifier.jsx';
import DropMenu from '../components/DropMenu.jsx';
import { Astroid, ClipboardCheck, Database, Flag, LayoutDashboard, Logs, Pyramid, RefreshCcw, Settings, SquareMenu, UserStar } from 'lucide-react';
import MainHeader from '../components/MainHeader.jsx';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api.jsx';
import NotificationBell from '../components/NotificationBell.jsx';

const { Header, Sider, Content } = Layout;


const flattenMenuItems = (items) => {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) {
      acc.push(...flattenMenuItems(item.children));
    }
    return acc;
  }, []);
};

export default function MainLayout() {
  const [appVersion, setAppVersion] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions, roles } = useAuth();
  const [notifications, setNotifications] = useState({});

  useEffect(() => {
    window.electron?.getVersion().then(setAppVersion);
  }, []);



  const getNotifications = async () => {
    try {
      const response = await api.get("dashboard/notifications");
      setNotifications(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {

    getNotifications();

    const interval = setInterval(getNotifications, 30000);

    return () => clearInterval(interval);
  }, []);



  const menuItems = useMemo(
    () => [
      { key: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      {
        key: '/reclamations',
        icon: <Flag size={18} />,
        label: (
          <>
            Réclamations
            <Badge
              className="ml-2"
              showZero={false}
              count={
                (roles('smq')
                  ? notifications?.validated_reclamation_count
                  : roles('dr_commercial')
                    ? notifications?.new_recalmations_count
                    : 0) ?? 0
              }
            />
          </>
        ),
        title: 'Réclamations',
        disabled: !permissions('voir.reclamations'),
      },
      {
        key: '/correction-actions',
        icon: <Astroid size={18} />,
        label: <>Actions Corrective <Badge className="ml-2" showZero={false} count={notifications?.new_corrective_action}></Badge></>,
        title: 'Actions Corrective',
        disabled: !permissions('voir.actions_correctives')
      },
      {
        key: '/improvements',
        icon: <Pyramid size={18} />,
        label: (
          <>
            Améliorations
            {roles(['dr_general']) && (
              <Badge
                className="ml-2"
                count={notifications?.registered_improvement_sheets || 0}
                showZero={false}
              />
            )}
          </>
        ),
        title: 'Améliorations',
        disabled: !permissions('voir.fiches_amelioration'),
      },
      {
        key: '/improvements-journal',
        icon: <Logs size={18} />,
        label: "Registre d'amélioration",
        disabled: !permissions('voir.journal_amelioration'),
        title: "Registre fiches d'amélioration",
      }
           ,
      { key: '/register', icon: <SquareMenu size={18} />, label: 'Registre de réclamation', disabled: !permissions('voir.registre_reclamations') },
      {
        key: '/settings',
        icon: <Settings size={18} />,
        label: 'Paramètres',
        children: [
          {
            key: '/users',
            disabled: !permissions('voir.utilisateurs'),
            icon: <RefreshCcw size={18} />,
            label: 'Utilisateurs',
          },
          {
            key: '/services',
            icon: <UserStar size={18} />,
            disabled: !permissions('voir.processus'),
            label: 'Processus ',
          },
          {
            key: '/roles',
            disabled: !permissions('voir.roles'),
            icon: <ClipboardCheck size={18} />,
            label: 'Rôles et permissions',

          },
          {
            key: '/connections',
            icon: <Database size={18} />,
            disabled: !permissions('voir.connexions'),
            label: 'Connexions DB',
            title: 'Connexions à la base de données'
          },
        ],
      },
    ],
    [permissions, roles, notifications]
  );

  const flatMenuItems = useMemo(() => flattenMenuItems(menuItems), [menuItems]);

  useEffect(() => {
    const currentItem = flatMenuItems.find((item) => item.key === location.pathname);
    if (currentItem) {
      document.title = currentItem.title || currentItem.label;
      const titleEl = document.getElementById('title');
      if (titleEl) titleEl.innerHTML = currentItem.title || currentItem.label;
    }
  }, [location.pathname, flatMenuItems]);

  return (


    <Layout style={{ height: '100vh' }}>
      <UpdateNotifier />

      <Sider
        width={220}
        theme="light"
        className="border-r border-gray-100 flex flex-col bg-green-900"
        style={{ height: '100vh' }}
      >
        <div className="px-4 py-4">
          <Link to="/">
            <h1 className='text-white text-xl p-0 m-0 text-start'>SMQ PRO</h1>
            <span className='text-white'> SERIEMOBLE {appVersion && <span className="text-gray-400 font-normal text-xs ml-1">v{appVersion}</span>}</span>
          </Link>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          onClick={(e) => navigate(e.key)}
          className="border-r-0 flex-1 bg-green-900 sidebar-menu"
          items={menuItems}
          style={{
            '--ant-menu-item-selected-bg': '#dcfce7', // green-100
            '--ant-menu-item-selected-color': '#16a34a', // green-600
          }}
        />
        <style>{`
            .sidebar-menu .ant-menu-item-disabled,
            .sidebar-menu .ant-menu-submenu-disabled > .ant-menu-submenu-title {
              opacity: 0.4 !important;
              color: rgba(255, 255, 255, 0.45) !important;
            }
            .sidebar-menu .ant-menu-item-disabled .anticon,
            .sidebar-menu .ant-menu-submenu-disabled > .ant-menu-submenu-title .anticon,
            .sidebar-menu .ant-menu-item-disabled svg,
            .sidebar-menu .ant-menu-submenu-disabled > .ant-menu-submenu-title svg {
              opacity: 0.4 !important;
              color: rgba(255, 255, 255, 0.45) !important;
            }
          `}</style>
      </Sider>

      <Layout>
        <MainHeader appVersion={appVersion} />

        <Content className="bg-gray-100 overflow-auto" style={{ minWidth: 0 }}>
          <div
            className="m-2 rounded-lg bg-white shadow-sm"
            style={{ minWidth: 0, overflow: 'hidden' }}
          >
            <Outlet context={{ appVersion }} />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}