import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Form,
    Input,
    DatePicker,
    Row,
    Col,
    Button,
    Space,
    Select,
    Spin,
    Tooltip,
    message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { User } from "lucide-react";
import { api } from "../utils/api";
import PersonForm from "./PersonForm";

const { TextArea } = Input;

/**
 * CreateForm
 *
 * - Without `parentAction`: creates a normal corrective action.
 * - With `parentAction`: creates a sub-action of that action.
 *
 * The two modes share the exact same fields. The only difference is the
 * last one: "Responsable" (responsable_id) for an action, "RSP de traitement"
 * (person_id) for a sub-action. A sub-action also sends `parent_id`.
 */
export default function CreateForm({
    onSubmit,
    onCancel,
    loading,
    parentAction = true,
}) {
    const [form] = Form.useForm();

    const isSubAction = !!parentAction;

    const [services, setServices] = useState([]);
    const [responsables, setResponsables] = useState([]);

    // --- Persons (RSP de traitement, sub-action only) ---
    const [persons, setPersons] = useState([]);
    const [personsLoading, setPersonsLoading] = useState(false);
    const [personModalOpen, setPersonModalOpen] = useState(false);

    // --- Live search state for reclamations ---
    const [reclamations, setReclamations] = useState([]);
    const [reclamationsLoading, setReclamationsLoading] = useState(false);
    const fetchIdRef = useRef(0); // guards against out-of-order responses

    const getServices = async () => {
        try {
            const { data } = await api.get("services");

            const rows = Array.isArray(data) ? data : data?.data ?? [];

            setServices(
                rows.map((item) => ({
                    label: item.name,
                    value: Number(item.id),
                }))
            );
        } catch (error) {
            message.error(
                error?.response?.data?.message ||
                    "Erreur lors du chargement des services."
            );
        }
    };

    const getResponsables = async () => {
        try {
            const { data } = await api.get("users/responsibles");

            const rows = Array.isArray(data) ? data : data?.data ?? [];

            setResponsables(
                rows.map((item) => ({
                    label: item.full_name || item.name,
                    value: Number(item.id),
                }))
            );
        } catch (error) {
            message.error(
                error?.response?.data?.message ||
                    "Erreur lors du chargement des responsables."
            );
        }
    };

    // Loads persons and optionally auto-selects a newly created one.
    const getPersons = async (selectedPersonId = null) => {
        try {
            setPersonsLoading(true);

            const { data } = await api.get("persons");

            const rows = Array.isArray(data) ? data : data?.data ?? [];

            setPersons(
                rows.map((person) => ({
                    label: person.full_name,
                    value: Number(person.id),
                }))
            );

            if (selectedPersonId != null) {
                form.setFieldValue("person_id", Number(selectedPersonId));
            }
        } catch (error) {
            message.error(
                error?.response?.data?.message ||
                    "Erreur lors du chargement des personnes."
            );
        } finally {
            setPersonsLoading(false);
        }
    };

    // Fetches reclamations from the backend, optionally filtered by a search term.
    const fetchReclamations = useCallback(async (search = "") => {
        const currentFetchId = ++fetchIdRef.current;
        setReclamationsLoading(true);

        try {
            const { data } = await api.get("reclamations", {
                params: {
                    search: search || undefined,
                    per_page: 20,
                },
            });

            // Ignore stale responses (e.g. a fast typer firing several requests)
            if (currentFetchId !== fetchIdRef.current) return;

            const rows = Array.isArray(data) ? data : data?.data ?? [];

            setReclamations(
                rows.map((item) => ({
                    label: `${item.code} - ${item.client_code}`,
                    value: Number(item.id),
                }))
            );
        } catch (error) {
            if (currentFetchId !== fetchIdRef.current) return;

            message.error(
                error?.response?.data?.message ||
                    "Erreur lors du chargement des Reclamations."
            );
        } finally {
            if (currentFetchId === fetchIdRef.current) {
                setReclamationsLoading(false);
            }
        }
    }, []);

    // Debounce the search so we don't fire a request on every keystroke
    const debouncedFetchReclamations = useMemo(() => {
        let timeoutId;

        const debounced = (search) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                fetchReclamations(search);
            }, 400);
        };

        debounced.cancel = () => clearTimeout(timeoutId);

        return debounced;
    }, [fetchReclamations]);

    useEffect(() => {
        return () => debouncedFetchReclamations.cancel();
    }, [debouncedFetchReclamations]);

    // Initial load: shared data for both modes, then the one list that differs.
    useEffect(() => {
        getServices();
        fetchReclamations(); // initial page (no search term)

        if (isSubAction) {
            getPersons();
        } else {
            getResponsables();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSubAction]);

    const handlePersonCreated = async (person) => {
        setPersonModalOpen(false);

        // Refresh the list and auto-select the new person
        await getPersons(person?.id);
    };

    const handleFinish = (vals) => {
        const payload = {
            description: vals.description,
            due_date: vals.due_date.format("YYYY-MM-DD"),
            type: vals.type,
            service_id: Number(vals.service_id),
            reclamation_id: vals.reclamation_id
                ? Number(vals.reclamation_id)
                : undefined,
        };

        if (isSubAction) {
            // payload.parent_id = Number(parentAction.id);
            payload.person_id = Number(vals.person_id);
        } else {
            payload.responsable_id = Number(vals.responsable_id);
        }

        console.log(payload)

        onSubmit(payload);
    };

    return (
        <>
            <Form
                form={form}
                layout="vertical"
                initialValues={{ type: "Action corrective" }}
                onFinish={handleFinish}
            >
                <Form.Item name="reclamation_id" label="Réclamation">
                    <Select
                        placeholder="Rechercher une réclamation (code, client...)"
                        options={reclamations}
                        showSearch
                        filterOption={false}
                        onSearch={debouncedFetchReclamations}
                        notFoundContent={
                            reclamationsLoading ? <Spin size="small" /> : null
                        }
                        loading={reclamationsLoading}
                        allowClear
                    />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="Description"
                    rules={[{ required: true }]}
                >
                    <TextArea rows={4} autoFocus />
                </Form.Item>

                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item
                            name="due_date"
                            label="Date d'échéance"
                            rules={[{ required: true }]}
                        >
                            <DatePicker
                                className="w-full"
                                format="DD/MM/YYYY"
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item name="type" label="Type">
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item
                            name="service_id"
                            label="Processus"
                            rules={[{ required: true }]}
                        >
                            <Select
                                placeholder="Sélectionner un processus"
                                options={services}
                                showSearch
                                optionFilterProp="label"
                            />
                        </Form.Item>
                    </Col>

                    {/* The only field that changes between the two modes */}
                    <Col span={12}>
                        {isSubAction ? (
                            <Form.Item label="RSP de traitement" required>
                                <div className="flex items-start gap-2">
                                    <Form.Item
                                        name="person_id"
                                        noStyle
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Veuillez sélectionner une personne.",
                                            },
                                        ]}
                                    >
                                        <Select
                                            options={persons}
                                            placeholder="Sélectionner une personne"
                                            loading={personsLoading}
                                            suffixIcon={<User size={16} />}
                                            showSearch
                                            optionFilterProp="label"
                                            allowClear
                                            className="flex-1"
                                        />
                                    </Form.Item>

                                    <Tooltip title="Ajouter une personne">
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() =>
                                                setPersonModalOpen(true)
                                            }
                                        />
                                    </Tooltip>
                                </div>
                            </Form.Item>
                        ) : (
                            <Form.Item
                                name="responsable_id"
                                label="Responsable"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    placeholder="Sélectionner un responsable"
                                    options={responsables}
                                    showSearch
                                    optionFilterProp="label"
                                />
                            </Form.Item>
                        )}
                    </Col>
                </Row>

                <Form.Item className="mb-0 text-right">
                    <Space>
                        <Button onClick={onCancel}>Annuler</Button>

                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                        >
                            {isSubAction
                                ? "Créer la sous-action"
                                : "Créer l'action"}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>

            {/* CREATE PERSON MODAL (sub-action only) */}
            {isSubAction && (
                <PersonForm
                    open={personModalOpen}
                    onCancel={() => setPersonModalOpen(false)}
                    onSuccess={handlePersonCreated}
                />
            )}
        </>
    );
}