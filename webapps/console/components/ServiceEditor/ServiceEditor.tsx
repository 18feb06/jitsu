import { EditorComponentProps } from "../ConfigObjectEditor/ConfigEditor";
import React, { useCallback, useEffect, useState } from "react";
import { getLog, rpc } from "juava";
import { EditorTitle } from "../ConfigObjectEditor/EditorTitle";
import { EditorBase } from "../ConfigObjectEditor/EditorBase";
import { LoadingAnimation } from "../GlobalLoader/GlobalLoader";
import { EditorField } from "../ConfigObjectEditor/EditorField";
import { TextEditor } from "../ConnectionEditorPage/ConnectionEditorPage";
import { ServiceConfig } from "../../lib/schema";
import { Button, Select } from "antd";
import { SnippedEditor } from "../CodeEditor/SnippedEditor";
import { EditorButtons } from "../ConfigObjectEditor/EditorButtons";
import { getConfigApi } from "../../lib/useApi";
import { feedbackError } from "../../lib/ui";
import { useWorkspace } from "../../lib/context";
import { useRouter } from "next/router";

const log = getLog("ServiceEditor");

type ServiceEditorProps = {} & EditorComponentProps;

const VersionSelector: React.FC<{ versions: string[]; onChange: (v: string) => void; value: string }> = ({
  versions,
  onChange,
  value,
}) => {
  const options = versions.map(v => ({ label: v, value: v }));
  return <Select onChange={onChange} value={value} options={options} className={"w-full"} />;
};

export const ServiceEditor: React.FC<ServiceEditorProps> = props => {
  const { object, meta, createNew, onCancel, onDelete, onTest, isNew, noun, loadMeta } = props;
  const workspace = useWorkspace();
  const { push } = useRouter();
  const [obj, setObj] = useState<Partial<ServiceConfig>>({
    ...props.object,
  });
  const [formState, setFormState] = useState<any | undefined>(undefined);
  const isTouched = formState !== undefined || !!createNew;
  const [loading, setLoading] = useState<boolean>(false);
  const [credUserProvided, setCredUserProvided] = useState(!!obj.credentials && obj.credentials !== "{}");
  const [loadingSpecs, setLoadingSpecs] = useState<boolean>(false);
  const [specs, setSpecs] = useState<any>(undefined);

  const change = useCallback(
    (key: string, value: any) => {
      setObj({
        ...obj,
        [key]: value,
      });
    },
    [obj]
  );

  useEffect(() => {
    if (credUserProvided || specs) {
      console.log("No need to load specs. Credentials are already filled.");
      return;
    }
    (async () => {
      console.log("Loading specs");
      setLoadingSpecs(true);
      try {
        const firstRes = await rpc(`/api/${workspace.id}/sources/spec?package=${obj.package}&version=${obj.version}`);
        if (firstRes.ok) {
          console.log("Loaded cached specs:", JSON.stringify(firstRes, null, 2));
          setSpecs(firstRes.specs);
          change("credentials", JSON.stringify(firstRes.fakeJson, null, 2));
        } else {
          for (let i = 0; i < 60; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log(
              "Loading specs attempt",
              `/api/${workspace.id}/sources/spec?package=${obj.package}&version=${obj.version}&after=${firstRes.startedAt}`
            );
            const resp = await rpc(
              `/api/${workspace.id}/sources/spec?package=${obj.package}&version=${obj.version}&after=${firstRes.startedAt}`
            );
            if (!resp.pending) {
              if (resp.error) {
                feedbackError(`Cannot load specs for ${obj.package}:${obj.version} error: ${resp.error}`);
                return;
              } else {
                console.log("Loaded specs:", JSON.stringify(resp, null, 2));
                setSpecs(resp.specs);
                change("credentials", JSON.stringify(resp.fakeJson, null, 2));
                return;
              }
            }
          }
          feedbackError(`Cannot load specs for ${obj.package}:${obj.version} error: Timeout`);
        }
      } catch (error) {
        feedbackError(`Cannot load specs for ${obj.package}:${obj.version} error: ${error}`);
      } finally {
        setLoadingSpecs(false);
      }
    })();
  }, [workspace.id, credUserProvided, obj.package, obj.version, change, specs]);

  const save = useCallback(async () => {
    setLoading(true);
    try {
      if (props.isNew) {
        await getConfigApi(workspace.id, "service").create(obj);
      } else if (obj.id) {
        await getConfigApi(workspace.id, "service").update(obj.id, obj);
      } else {
        feedbackError(`Can't save service without id`);
      }
      push(`/${workspace.id}/services`);
    } catch (error) {
      feedbackError(`Can't save service`, { error });
    } finally {
      setLoading(false);
    }
  }, [props.isNew, obj, workspace.id, push]);

  if (meta === undefined) {
    return <LoadingAnimation />;
  } else {
    const title = props.editorTitle
      ? props.editorTitle(object, isNew, meta)
      : isNew
      ? `Create new ${noun}`
      : `Edit ${noun}`;
    return (
      <EditorBase isTouched={isTouched} onCancel={onCancel}>
        <EditorTitle title={title} onBack={() => onCancel(isTouched)} />
        <EditorField key={"name"} id={"name"} label={"Name"} required={true}>
          <TextEditor className="w-full" value={obj.name} onChange={change.bind(null, "name")} />
        </EditorField>
        <EditorField
          key={"version"}
          id={"version"}
          help={`Version of package: ${obj.package || meta.packageId}`}
          label={"Version"}
          required={true}
        >
          <VersionSelector
            value={obj.version ?? ""}
            onChange={v => {
              change.bind(null, "version")(v);
              setSpecs(undefined);
            }}
            versions={meta.versions}
          />
        </EditorField>
        <EditorField key={"credentials"} id={"credentials"} label={"Credentials"} required={true}>
          {loadingSpecs ? (
            <LoadingAnimation className={"h-52"} title={"Loading connector specifications..."} />
          ) : (
            <div className={"relative"}>
              <div className={"absolute top-2 right-2 z-50"}>
                <Button
                  type={"primary"}
                  ghost={true}
                  size={"small"}
                  onClick={() => {
                    setSpecs(undefined);
                    setCredUserProvided(false);
                  }}
                >
                  Generate example
                </Button>
              </div>
              <SnippedEditor
                value={obj.credentials ?? "{}"}
                onChange={v => {
                  change.bind(null, "credentials")(v);
                  setCredUserProvided(true);
                }}
                languages={["json"]}
                height={206}
              />
            </div>
          )}
        </EditorField>
        <EditorButtons
          isNew={isNew}
          loading={loading}
          onDelete={onDelete}
          onCancel={() => onCancel(isTouched)}
          onSave={save}
          onTest={() => onTest!(obj)}
        />
      </EditorBase>
    );
  }
};