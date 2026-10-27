import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Layout, Table, Tag, Button, Drawer, Modal, Input,
    Row, Col, Statistic, Space, Segmented, message, Empty, Card,
    Badge, Select, DatePicker,
    Tooltip,
} from "antd";
import {
    Plus, GitBranch, Search, Loader2, RefreshCw, X,
    Astroid,
    UserRoundX,
    User,
} from "lucide-react";
import dayjs from "dayjs";

import "antd/dist/reset.css";
import { correctiveActionsApi, extractErrorMessage } from "../utils/correctiveActionsApi";
import { dateFormat, isOverdue, STATUS_AC } from "../utils/config";
import { api } from "../utils/api";
import DrawerBody from "../components/DrawerBody";
import CreateForm from "../components/CorrectionActionCreateForm";
import RightClickMenu from "../components/ui/RightClickMenu";
import ImprovementSheetModal from "../components/ImprovementSheetModal";
import { useAuth } from "../contexts/AuthContext";
import reclamationApi from "../utils/reclamationApi";
import { Link } from "react-router-dom";

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;




const EFFECTIVENESS_OPTIONS = [
    { value: "efficace", label: "Efficace" },
    { value: "non_efficace", label: "Non efficace" },
    // { value: "en_cours", label: "En cours d'évaluation" },
];

function flattenTree(list) {
    const out = [];
    const walk = (arr) => {
        arr.forEach(item => {
            out.push(item);
            if (Array.isArray(item.children) && item.children?.length) {
                walk(item.children);
            }
        });
    };
    walk(list || []);
    return out;
}


function RealisationCell({ record, onSave, saving }) {
    const [editing, setEditing] = useState(false);

    if (record.completion_date) {
        return <span>{dateFormat(record.completion_date)}</span>;
    }

    if (editing) {
        return (
            <DatePicker
                size="small"
                autoFocus
                open
                format="DD MMM YYYY"
                disabled={saving}
                disabledDate={(current) => {
                    return current && current.isBefore(dayjs(), "day");
                }}
                onChange={(date) => {
                    setEditing(false);

                    if (date) {
                        onSave(record.id, date.format("YYYY-MM-DD"));
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) setEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    return (
        <Button
            type="link"
            size="small"
            className="!px-0"
            onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
            }}
        >
            + Ajouter
        </Button>
    );
}

/* ------------------------------ App ------------------------------- */

export default function CorrectiveActions() {

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // --- Search & filters (all resolved server-side) ---
    const [search, setSearch] = useState("");           // matches CA code OR reclamation code
    const [statusFilter, setStatusFilter] = useState("Toutes");
    const [effectiveness, setEffectiveness] = useState(undefined);
    const [serviceId, setServiceId] = useState(undefined);
    const [services, setServices] = useState([]);
    const [dateRange, setDateRange] = useState(null);    // [dayjs, dayjs] for created_at

    // --- Server-side pagination ---
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

    const [selectedId, setSelectedId] = useState(null);
    const [drawerTab, setDrawerTab] = useState("view");
    const [createOpen, setCreateOpen] = useState(false);
    const { permissions } = useAuth();

    const [open, setOpen] = useState(false);

    // Debounce ref for the free-text search input so we don't fire a
    // request on every keystroke.
    const debounceRef = useRef(null);

    const ROW_MENU_ITEMS = [
        { label: "Voir", key: "voir", disabled: !permissions('voir.action_corrective') },
        { label: "Modifier", key: "edit", disabled: !permissions('modifier.action_corrective') },
        { label: "Clôturer", key: "complete", disabled: !permissions('cloturer.action_corrective') },
        { label: "Ajouter une sous-action", key: "child", disabled: !permissions('creer.sous-action_corrective') },
        { label: "Fiche d'améliorationsn", key: "improvement", disabled: !permissions('creer.fiche_amelioration') },
        { type: "divider", key: "divider", disabled: !permissions('creer.fiche_amelioration') },
        { label: "Supprimer", key: "delete", danger: true, disabled: !permissions('supprimer.action_corrective') },
    ];



    // Fetch the services list once for the filter Select.
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("services");
                const opts = (data?.data || []).map((item) => ({
                    label: item.name,
                    value: item.id,
                }));
                setServices(opts);
            } catch (error) {
                message.error(
                    error?.response?.data?.message || "Erreur lors du chargement des services."
                );
            }
        })();
    }, []);

    // Resolves the backend `status` value from the human label shown in
    // the Segmented control, using whatever keys STATUS_AC defines —
    // avoids hardcoding status codes here.
    const statusValue = useMemo(() => {
        if (statusFilter === "Toutes") return undefined;
        const entry = Object.entries(STATUS_AC).find(([, v]) => v.label === statusFilter);
        return entry?.[0];
    }, [statusFilter]);

    const buildParams = useCallback((page, pageSize) => {
        const params = { page, per_page: pageSize };
        if (search) params.search = search;
        if (statusValue) params.status = statusValue;
        if (effectiveness) params.effectiveness = effectiveness;
        if (serviceId) params.service_id = serviceId;
        if (dateRange?.[0]) params.date_from = dateRange[0].format("YYYY-MM-DD");
        if (dateRange?.[1]) params.date_to = dateRange[1].format("YYYY-MM-DD");
        return params;
    }, [search, statusValue, effectiveness, serviceId, dateRange]);

    const fetchPage = useCallback(async (page, pageSize) => {
        setLoading(true);
        try {
            const params = buildParams(page, pageSize);
            const res = await correctiveActionsApi.list(params);
            // Laravel's paginate() returns { data, current_page, per_page, total, ... }.
            // Some axios setups wrap the whole response one level deeper
            // (e.g. { data: { data, current_page, ... } }), so unwrap defensively.
            const paginator = Array.isArray(res?.data) || res?.current_page !== undefined
                ? res
                : res?.data ?? res;
            const list = Array.isArray(paginator) ? paginator : paginator?.data;
            setItems(Array.isArray(list) ? list : []);
            setPagination({
                current: paginator?.current_page ?? page,
                pageSize: paginator?.per_page ?? pageSize,
                total: paginator?.total ?? (Array.isArray(list) ? list?.length : 0),
            });
        } catch (e) {
            message.error(extractErrorMessage(e));
        } finally { setLoading(false); }
    }, [buildParams]);

    // Any filter change resets to page 1 (only triggers a state update —
    // and therefore a re-render — when the page actually needs to move).
    useEffect(() => {
        setPagination(prev => (prev.current === 1 ? prev : { ...prev, current: 1 }));
    }, [search, statusValue, effectiveness, serviceId, dateRange]);

    // Single source of truth for fetching: fires on mount, on page/pageSize
    // change, and on filter change (via the effect above resetting `current`).
    useEffect(() => {
        fetchPage(pagination.current, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagination.current, pagination.pageSize, search, statusValue, effectiveness, serviceId, dateRange]);

    const refresh = useCallback(() => fetchPage(pagination.current, pagination.pageSize),
        [fetchPage, pagination.current, pagination.pageSize]);

    function handleSearchChange(value) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setSearch(value), 400);
    }

    function resetFilters() {
        setSearch("");
        setStatusFilter("Toutes");
        setEffectiveness(undefined);
        setServiceId(undefined);
        setDateRange(null);
    }

    function handleTableChange(paginationConfig) {
        const { current, pageSize } = paginationConfig;
        refresh(current, pageSize);
    }

    // Flat lookup table containing every row (parents AND nested
    // children) keyed only by array membership — used for id-based
    // lookups (selected item, right-click target, parent/child resolution).
    const flatItems = useMemo(() => flattenTree(items), [items]);

    const selected = flatItems.find(i => String(i.id) === String(selectedId)) || null;
    const childrenOf = (id) => flatItems.filter(i => String(i.parent_id) === String(id));
    const parentOf = (item) => flatItems.find(i => String(i.id) === String(item?.parent_id));

    function openDrawer(id, tab = "view") { setSelectedId(id); setDrawerTab(tab); }
    function closeDrawer() { setSelectedId(null); }

    async function handleCreate(payload) {
        setLoading(true);
        try {
            await reclamationApi.createCorrectiveAction(payload.reclamation_id, payload);
            setPagination(prev => (prev.current === 1 ? prev : { ...prev, current: 1 }));
            await refresh();
            setCreateOpen(false);
            message.success("Action corrective créée.");
        } catch (e) { message.error(extractErrorMessage(e)); } finally { setLoading(false); }
    }

    async function handleUpdate(id, payload) {
        setLoading(true);
        try {
            await correctiveActionsApi.update(id, payload);
            await refresh();
            message.success("Modifications enregistrées.");
        } catch (e) { message.error(extractErrorMessage(e)); } finally { setLoading(false); }
    }

    // Dedicated handler for the inline "Réalisation" date picker so it
    // doesn't trigger the generic "Modifications enregistrées" toast
    // wording used by the full edit form — keeps the feedback focused.
    async function handleSetCompletionDate(id, completionDate) {
        setLoading(true);
        try {
            await correctiveActionsApi.update(id, { completion_date: completionDate });
            await refresh();
            message.success("Date de réalisation ajoutée.");
        } catch (e) { message.error(extractErrorMessage(e)); } finally { setLoading(false); }
    }

    async function handleDelete(id) {
        setLoading(true);
        try {
            await correctiveActionsApi.remove(id);
            await refresh();
            if (String(selectedId) === String(id)) closeDrawer();
            message.success("Action corrective supprimée.");
        } catch (e) { message.error(extractErrorMessage(e)); } finally { setLoading(false); }
    }

    async function handleComplete(id, payload) {
        setLoading(true);
        try {
            await correctiveActionsApi.complete(id, payload);
            await refresh();
            message.success("Marquée comme clôture.");
            setDrawerTab("view");
        } catch (e) { message.error(extractErrorMessage(e)); } finally { setLoading(false); }
    }

    async function handleCreateChild(parentId, payload) {
        setLoading(true);
        try {
            await correctiveActionsApi.createChild(parentId, payload);
            await refresh();
            message.success("Action de suivi créée.");
            setDrawerTab("view");
        } catch (e) { message.error(extractErrorMessage(e)); } finally { setLoading(false); }
    }

    const STATUS_AC_OPTIONS = Object.values(STATUS_AC).map((status) => ({
        label: status.label,
        value: status.label,
    }));

    // Handles clicks coming from the right-click context menu.
    // `key` is the action (edit/complete/child/delete), `id` is the row id
    // that RightClickMenu extracts from the composite key it built.
    // Looks up in `flatItems` (not `items`) so this works for nested
    // child rows too, not just top-level parents.
    const handleRowMenuClick = useCallback((key, id) => {
        const row = flatItems.find(i => String(i.id) === String(id));
        if (!row) return;

        switch (key) {
            case "edit":
                openDrawer(row.id, "edit");
                break;
            case "complete":
                openDrawer(row.id, "complete");
                break;
            case "child":
                openDrawer(row.id, "child");
                break;
            case "improvement":
                setOpen(true)
                setSelectedId(row.id)
                break;
            case "voir":
                openDrawer(row.id, "view");
                break;

            case "delete":
                Modal.confirm({
                    title: "Supprimer cette action corrective ?",
                    content: row.children?.length > 0
                        ? `Elle a ${row.children?.length} suivi(s) lié(s) — le comportement de l'API dans ce cas n'est pas confirmé.`
                        : "Cette action est irréversible.",
                    okText: "Supprimer",
                    okButtonProps: { danger: true },
                    cancelText: "Annuler",
                    onOk: () => handleDelete(row.id),
                });
                break;
            default:
                break;
        }
    }, [flatItems]);

    // Wraps each <tr> so RightClickMenu can attach a contextmenu handler
    // scoped to that specific row, replacing the old actions column.
    // Looks up in `flatItems` so nested child rows resolve correctly.
    const RowWithContextMenu = useCallback((props) => {
        const rowId = props["data-row-key"];
        const row = flatItems.find(i => String(i.id) === String(rowId));

        const menuItems = ROW_MENU_ITEMS
            .map(item => ({
                ...item,
                id: rowId,
                disabled: item.key === "complete"
                    ? item.disabled || row?.status === "completed" || !row?.completion_date
                    : item.disabled,
            }));

        return (
            <RightClickMenu menuItems={menuItems} onItemClick={handleRowMenuClick}>
                <tr {...props} />
            </RightClickMenu>
        );
    }, [flatItems, handleRowMenuClick]);

    const overdueCount = flatItems.filter(isOverdue)?.length;
    const openCount = flatItems.filter(i => i.status === "open")?.length;

    const hasActiveFilters = !!(search || statusFilter !== "Toutes" || effectiveness || serviceId || dateRange);

    const columns = [
         {
            title: "Ref", dataIndex: "code", width: 140,
            render: (code) => (
                <span className="flex items-center gap-1">
                    {code ?? "—"}
                </span>
            ),
        },

        {
            title: "Reclamation", dataIndex: "reclamation", width: 140,
            render: (reclamation) => (
                <Link to={`/reclamations?reclamation_id=${reclamation.id}`} className="flex items-center gap-1">
                    {reclamation?.code ?? "—"}
                </Link>
            ),
        },
        {
            title: "Action",
            dataIndex: "description",
            width: 90,
            render: (description) => {
                if (!description) return "—";

                return (
                    <Tooltip title={description}>
                        <span className="whitespace-nowrap">
                            {description?.length > 50
                                ? `${description.slice(0, 50)}...`
                                : description}
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: "Client", dataIndex: "reclamation", width: 90,
            render: (reclamation) => <div>{reclamation?.client_code ?? ""}</div>,
        },
        {
            title: "Processus", dataIndex: "service", width: 90,
            render: (service) => <div className="whitespace-nowrap">{service?.name ?? ""}</div>,
        },
        {
            title: "Responsable",
            dataIndex: "responsable",
            width: 160,
            render: (responsable, record) => {
                const isPerson = !!record?.person;

                // console.log(record);
                // console.log(responsable)

                const name =
                    record?.person?.full_name ||
                    responsable?.full_name ||
                    "";

                return (
                    <span className="whitespace-nowrap flex items-center gap-1.5">
                        {isPerson ? (
                            <UserRoundX
                                size={15}
                                className="text-orange-500"
                            />
                        ) : (
                            <User
                                size={15}
                                className="text-blue-500"
                            />
                        )}

                        {name}
                    </span>
                );
            },
        },
        {
            title: "Statut", dataIndex: "status", width: 130,
            render: (s) => <Tag color={STATUS_AC[s]?.color}>{STATUS_AC[s]?.label || s}</Tag>,
        },

        {
            title: "Réalisation", dataIndex: "completion_date", width: 130,
            render: (completion_date, record) => (
                <RealisationCell
                    record={record}
                    saving={loading}
                    onSave={handleSetCompletionDate}
                />
            ),
        },

        {
            title: "Efficacité", dataIndex: "effectiveness", width: 90,
            render: (effectiveness) => <span className="whitespace-nowrap">{effectiveness}</span> ?? "",
        },

        {
            title: "Clôture", dataIndex: "closing_date", width: 90,
            render: (closing_date) => <span className="whitespace-nowrap">{dateFormat(closing_date)}</span> ?? "",
        },
        {
            title: "Échéance", dataIndex: "due_date", width: 130,
            render: (d, row) => (
                <span className={isOverdue(row) ? "font-medium text-red-600 whitespace-nowrap" : "text-slate-600 whitespace-nowrap"}>
                    {d ? dayjs(d).format("DD MMM YYYY") : ""}
                </span>
            ),
        },
    ];

    return (
        <Layout className="min-h-full bg-slate-100">
            <Header className="flex items-center justify-between !bg-white !px-6 border-b border-slate-200" style={{ height: 64, lineHeight: "64px" }}>
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-700 text-white">
                        <Astroid size={18} />
                    </div>
                    <div className="leading-tight">
                        <div className="text-base font-semibold text-slate-900">Actions correctives</div>
                        <div className="text-xs text-slate-500">Cycle de vie des actions correctives.</div>
                    </div>
                </div>
                <Space>
                    <Button icon={loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} onClick={() => refresh()}></Button>
                    <Button disabled={!permissions('creer.action_corrective')} type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
                        Nouvelle
                    </Button>
                </Space>
            </Header>

            <Content className="mx-auto w-full px-4 py-4">
                {/* Search & filters */}
                <Card size="small" className="mb-3">
                    <Row gutter={[12, 12]} align="middle">
                        <Col flex="270px">
                            <Input
                                allowClear
                                placeholder="Ref réclamation, AC..."
                                prefix={<Search size={14} className="text-slate-400" />}
                                defaultValue={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                        </Col>
                        <Col flex="270px">
                            <RangePicker
                                className="w-full"
                                placeholder={["Créée après", "Créée avant"]}
                                value={dateRange}
                                onChange={setDateRange}
                                format="DD MMM YYYY"
                            />
                        </Col>

                        <Col flex="200px">
                            <Select
                                allowClear
                                showSearch
                                placeholder="Processus"
                                className="w-full"
                                options={services}
                                value={serviceId}
                                onChange={setServiceId}
                                filterOption={(input, option) =>
                                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                                }
                            />
                        </Col>

                        <Col flex="180px">
                            <Select
                                allowClear
                                placeholder="Efficacité"
                                className="w-full"
                                options={EFFECTIVENESS_OPTIONS}
                                value={effectiveness}
                                onChange={setEffectiveness}
                            />
                        </Col>


                        <Col flex="180px">


                            <Select
                                allowClear
                                placeholder="Efficacité"
                                className="w-full"
                                options={STATUS_AC_OPTIONS}
                                value={statusFilter}
                                onChange={setStatusFilter}
                            />
                        </Col>
                        {hasActiveFilters && (
                            <Col>
                                <Button icon={<X size={14} />} onClick={resetFilters}>
                                    Réinitialiser
                                </Button>
                            </Col>
                        )}
                    </Row>
                </Card>

                <Card size="small" styles={{ body: {padding: 0} }}>
                    <Table
                        rowKey="id"
                        size="small"
                        columns={columns}
                        dataSource={items}
                        loading={loading}
                        scroll={{ x: "max-content" }}
                        pagination={{
                            current: pagination.current,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            showSizeChanger: true,
                            showTotal: (total) => `${total} action(s) corrective(s)`,
                        }}
                        onChange={handleTableChange}
                        locale={{
                            emptyText: <Empty description="Aucune action corrective trouvée" />,
                        }}
                        rowClassName={(record) =>
                            record.parent_id ? "bg-slate-50/70" : ""
                        }
                        components={{
                            body: {
                                row: RowWithContextMenu,
                            },
                        }}
                    />
                </Card>
            </Content>

            {/* Detail drawer */}
            <Drawer
                open={!!selected}
                onClose={closeDrawer}
                title={selected ? <span className="text-sm text-slate-400">{selected.code}</span> : ""}
                width={440}
                extra={selected && <Tag color={STATUS_AC[selected.status]?.color}>{STATUS_AC[selected.status]?.label || selected.status}</Tag>}
            >
                {selected && (
                   <DrawerBody
                        item={selected}
                        parent={parentOf(selected)}
                        childActions={childrenOf(selected.id)}
                        activeTab={drawerTab}
                        setActiveTab={setDrawerTab}
                        onOpenRelated={(id) => openDrawer(id, "view")}
                        onUpdate={(payload) => handleUpdate(selected.id, payload)}
                        onComplete={(payload) => handleComplete(selected.id, payload)}
                        onCreateChild={(payload) => handleCreateChild(selected.id, payload)}
                        loading={loading}
                    />
                )}
            </Drawer>

            {/* Create modal */}
            <Modal
                open={createOpen}
                title="Nouvelle action corrective"
                onCancel={() => setCreateOpen(false)}
                footer={null}
                destroyOnHidden
            >
                <CreateForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} loading={loading} />
            </Modal>
            <ImprovementSheetModal
                open={open}
                onClose={() => setOpen(false)}
                corrective_action_id={selectedId}
            />
        </Layout>
    );
}