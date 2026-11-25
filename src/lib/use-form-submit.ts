"use client";

// Envio de formulário com useActionState SEM apagar o que a pessoa digitou.
//
// Com <form action={formAction}>, o React 19 reseta o formulário depois de toda
// action — inclusive quando ela volta com erro. A pessoa erra uma data e perde
// título, capa, descrição... Aqui o envio vai pelo onSubmit (o React não reseta),
// e o destaque de erro de um campo some assim que ele é editado, pra ficar claro
// o que ainda falta corrigir.
//
// Uso:
//   const [state, formAction, pending] = useActionState(action, undefined);
//   const { formProps, fieldErrors } = useFormSubmit(state, formAction);
//   <form {...formProps}> ... error={fieldErrors?.title}
//
// Botões com name/value (ex.: name="intent" value="publish") entram no FormData.

import { startTransition, useState, type FormEvent } from "react";

type MaybeFieldErrors = { fieldErrors?: Record<string, string> } | null | undefined;

export function useFormSubmit<S>(state: S, dispatch: (formData: FormData) => void) {
  // Campos já editados depois deste resultado. Novo resultado do servidor = lista zerada.
  const [edited, setEdited] = useState<{ result: S; names: string[] }>({ result: state, names: [] });
  const names = edited.result === state ? edited.names : [];

  const all = (state as MaybeFieldErrors)?.fieldErrors;
  const fieldErrors: Record<string, string> | undefined = all
    ? Object.fromEntries(Object.entries(all).filter(([name]) => !names.includes(name)))
    : undefined;

  return {
    fieldErrors,
    formProps: {
      onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => dispatch(formData));
      },
      onChange(event: FormEvent<HTMLFormElement>) {
        const name = (event.target as HTMLInputElement).name;
        if (name && all?.[name] && !names.includes(name)) setEdited({ result: state, names: [...names, name] });
      },
    },
  };
}
