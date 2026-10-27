import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  DatePicker,
  Button,
  Select,
  message,
  Tooltip,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { User } from "lucide-react";
import dayjs from "dayjs";
import { api } from "../utils/api";
import PersonForm from "./PersonForm";

const { TextArea } = Input;

export default function CorrectiveActionEditForm({
  item,
  onSubmit,
  loading,
}) {
  const [form] = Form.useForm();

  const [responsables, setResponsables] = useState([]);
  const [persons, setPersons] = useState([]);
  const [personsLoading, setPersonsLoading] =
    useState(false);

  const [personModalOpen, setPersonModalOpen] =
    useState(false);

  /**
   * A sub-action has a parent_id
   */
  const isSubAction =
    item?.parent_id !== null &&
    item?.parent_id !== undefined;

  /**
   * =====================================================
   * GET RESPONSABLES
   * =====================================================
   */
  const getResponsables = async () => {
    try {
      const { data } = await api.get(
        "users/responsibles"
      );

      const rows =
        data?.data || data || [];

      setResponsables(
        rows.map((user) => ({
          label:
            user.full_name ||
            user.name,
          value: Number(user.id),
        }))
      );
    } catch (error) {
      console.error(error);

      message.error(
        error?.response?.data?.message ||
          "Erreur lors du chargement des responsables."
      );
    }
  };

  /**
   * =====================================================
   * GET PERSONS
   * =====================================================
   */
  const getPersons = async (
    selectedPersonId = null
  ) => {
    try {
      setPersonsLoading(true);

      const { data } = await api.get(
        "persons"
      );

      const rows =
        data?.data || data || [];

      const options = rows.map(
        (person) => ({
          label: person.full_name,
          value: Number(person.id),
        })
      );

      setPersons(options);

      /**
       * Automatically select newly
       * created person.
       */
      if (selectedPersonId !== null) {
        form.setFieldValue(
          "person_id",
          Number(selectedPersonId)
        );
      }
    } catch (error) {
      console.error(error);

      message.error(
        error?.response?.data?.message ||
          "Erreur lors du chargement des personnes."
      );
    } finally {
      setPersonsLoading(false);
    }
  };

  /**
   * =====================================================
   * INITIAL LOAD
   * =====================================================
   */
  useEffect(() => {
    getResponsables();

    if (isSubAction) {
      getPersons();
    }
  }, [isSubAction]);

  /**
   * =====================================================
   * SET FORM VALUES
   * =====================================================
   */
  useEffect(() => {
    if (!item) return;

    const values = {
      description: item.description,

      due_date: item.due_date
        ? dayjs(item.due_date)
        : null,
    };

    if (isSubAction) {
      values.person_id =
        item.person_id != null
          ? Number(item.person_id)
          : undefined;
    } else {
      values.responsable_id =
        item.responsable_id != null
          ? Number(item.responsable_id)
          : undefined;
    }

    form.setFieldsValue(values);
  }, [
    item,
    isSubAction,
    form,
  ]);

  /**
   * =====================================================
   * SUBMIT
   * =====================================================
   */
  const handleFinish = (values) => {
    const payload = {
      description:
        values.description,

      due_date: values.due_date
        ? values.due_date.format(
            "YYYY-MM-DD"
          )
        : undefined,
    };

    if (isSubAction) {
      payload.person_id =
        values.person_id != null
          ? Number(values.person_id)
          : undefined;
    } else {
      payload.responsable_id =
        values.responsable_id != null
          ? Number(
              values.responsable_id
            )
          : undefined;
    }

    onSubmit(payload);
  };

  /**
   * =====================================================
   * PERSON CREATED
   * =====================================================
   */
  const handlePersonCreated = async (
    person
  ) => {
    setPersonModalOpen(false);

    /**
     * Refresh persons list and
     * automatically select new person.
     */
    await getPersons(person?.id);
  };

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
      >
        {/* DESCRIPTION */}

        <Form.Item
          name="description"
          label="Description"
          rules={[
            {
              required: true,
              message:
                "La description est requise.",
            },
          ]}
        >
          <TextArea rows={4} />
        </Form.Item>

        {/* DUE DATE */}

        <Form.Item
          name="due_date"
          label="Date d'échéance"
          rules={[
            {
              required: true,
              message:
                "La date d'échéance est requise.",
            },
          ]}
        >
          <DatePicker
            className="w-full"
            format="DD/MM/YYYY"
          />
        </Form.Item>

        {/* RESPONSABLE / PERSON */}

        {isSubAction ? (
          <Form.Item
            label="RSP de traitment 22"
            required
          >
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
                  loading={
                    personsLoading
                  }
                  suffixIcon={
                    <User size={16} />
                  }
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  className="flex-1"
                />
              </Form.Item>

              <Tooltip title="Ajouter une personne">
                <Button
                  type="primary"
                  icon={
                    <PlusOutlined />
                  }
                  onClick={() =>
                    setPersonModalOpen(
                      true
                    )
                  }
                />
              </Tooltip>
            </div>
          </Form.Item>
        ) : (
          <Form.Item
            name="responsable_id"
            label="Responsable"
            rules={[
              {
                required: true,
                message:
                  "Veuillez sélectionner un responsable.",
              },
            ]}
          >
            <Select
              options={responsables}
              placeholder="Sélectionner un responsable"
              suffixIcon={
                <User size={16} />
              }
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
        )}

        {/* SAVE */}

        <Form.Item className="mb-0 text-right">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
          >
            Enregistrer
          </Button>
        </Form.Item>
      </Form>

      {/* ================================================= */}
      {/* CREATE PERSON MODAL */}
      {/* ================================================= */}

      <PersonForm
        open={personModalOpen}
        onCancel={() =>
          setPersonModalOpen(false)
        }
        onSuccess={
          handlePersonCreated
        }
      />
    </>
  );
}