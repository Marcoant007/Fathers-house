import { z } from "zod";
import { parseSaoPauloInput } from "@/lib/datetime";
import { isSpotifyUrl, isYoutubeUrl } from "@/lib/live-rules";

const optionalLink = (check: (url: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || check(v), message)
    .transform((v) => v || null);

export const liveStreamSchema = z
  .object({
    title: z.string().trim().min(2, "Dê um nome, ex.: Culto da Família").max(140),
    // datetime-local sem fuso = horário de Brasília
    startsAt: z.preprocess(parseSaoPauloInput, z.coerce.date({ error: "Informe a data e a hora" })),
    youtubeUrl: optionalLink(isYoutubeUrl, "Cole um link do YouTube (youtube.com ou youtu.be)"),
    spotifyUrl: optionalLink(isSpotifyUrl, "Cole um link do Spotify (open.spotify.com)"),
    description: z
      .string()
      .trim()
      .max(300)
      .transform((v) => v || null),
    visible: z.boolean(),
  })
  .refine((d) => d.youtubeUrl || d.spotifyUrl, {
    path: ["youtubeUrl"],
    message: "Coloque pelo menos o link do YouTube ou do Spotify",
  });

export const liveChannelsSchema = z.object({
  youtube: optionalLink(isYoutubeUrl, "Cole o link do canal no YouTube (youtube.com/@…)"),
  spotify: optionalLink(isSpotifyUrl, "Cole o link do perfil/podcast no Spotify (open.spotify.com/…)"),
});
