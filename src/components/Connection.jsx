import React, { useEffect, useState } from 'react';
import { Select, Input, Button, message } from 'antd';
import {
    LoadingOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';

export default function Connection() {
    const connections = [
        {
            label: 'Local',
            value: 'http://192.168.1.38:60/api/',
        },
        {
            label: 'Online',
            value: 'https://smq-seri.intercocina.online/api/',
        },
        {
            label: 'Développement',
            value: 'http://localhost:8000/api/',
        },
        {
            label: 'Personnalisée',
            value: 'custom',
        },
    ];

    // Local is the default connection
    const DEFAULT_CONNECTION = connections[0].value;

    const [connection, setConnection] = useState(DEFAULT_CONNECTION);
    const [customUrl, setCustomUrl] = useState('');
    const [testing, setTesting] = useState(false);
    const [selectedValue, setSelectedValue] = useState(DEFAULT_CONNECTION);

    useEffect(() => {
        const savedConnection = localStorage.getItem('connection_url');

        if (savedConnection) {
            const isPredefined = connections.some(
                (c) => c.value === savedConnection
            );

            setConnection(savedConnection);
            setSelectedValue(isPredefined ? savedConnection : 'custom');

            if (!isPredefined) {
                setCustomUrl(savedConnection);
            }
        } else {
            // Save Local as the default connection
            localStorage.setItem('connection_url', DEFAULT_CONNECTION);
        }
    }, []);

    const testUrl = async (url) => {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: AbortSignal.timeout(5000),
            });

            return response.type === 'opaque' || response.ok;
        } catch {
            return false;
        }
    };

    const saveUrl = (url) => {
        setConnection(url);
        localStorage.setItem('connection_url', url);

        message.success({
            content: 'Connexion enregistrée ✅',
            icon: <CheckCircleOutlined />,
        });

        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleSelect = async (value) => {
        setSelectedValue(value);

        if (value === 'custom') {
            setConnection('');
            setCustomUrl('');
            return;
        }

        setTesting(true);

        message.loading({
            content: 'Test de connexion en cours...',
            key: 'test',
            duration: 0,
        });

        const ok = await testUrl(value);

        setTesting(false);

        if (!ok) {
            message.error({
                content: `Impossible de joindre ${value}`,
                key: 'test',
                duration: 4,
                icon: <CloseCircleOutlined />,
            });

            // Keep the previous connection
            return;
        }

        message.destroy('test');
        saveUrl(value);
    };

    const saveCustomUrl = async () => {
        const url = customUrl.trim();

        if (!/^https?:\/\//i.test(url)) {
            message.error("L'URL doit commencer par http:// ou https://");
            return;
        }

        setTesting(true);

        message.loading({
            content: 'Test de connexion en cours...',
            key: 'test',
            duration: 0,
        });

        const ok = await testUrl(url);

        setTesting(false);

        if (!ok) {
            message.error({
                content: `Impossible de joindre ${url}`,
                key: 'test',
                duration: 4,
                icon: <CloseCircleOutlined />,
            });

            return;
        }

        message.destroy('test');
        saveUrl(url);
    };

    const showCustomInput = selectedValue === 'custom';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                width: 300,
            }}
        >
            <Select
                placeholder="Type de connexion"
                options={connections}
                onChange={handleSelect}
                value={selectedValue}
                disabled={testing}
                suffixIcon={testing ? <LoadingOutlined /> : undefined}
            />

            {showCustomInput && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                        placeholder="Entrez votre URL personnalisée"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        disabled={testing}
                        onPressEnter={saveCustomUrl}
                    />

                    <Button
                        type="primary"
                        onClick={saveCustomUrl}
                        loading={testing}
                    >
                        Sauvegarder
                    </Button>
                </div>
            )}
        </div>
    );
}