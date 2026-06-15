"use client"

import * as React from "react"
// We import from next-themes for theme detection, but in this standard React app
// we'll mock it if not using next-themes
// import { useTheme } from "next-themes"
const useTheme = () => ({ theme: "dark" }); // Mock for now or configure appropriately

import {
  CardTransformed,
  CardsContainer,
  ContainerScroll,
  ReviewStars,
} from "@/components/ui/animated-cards-stack"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const TESTIMONIALS = [
  {
    id: "testimonial-1",
    name: "James S.",
    profession: "Frontend Developer",
    rating: 5,
    description:
      "Their innovative solutions and quick turnaround time made our collaboration incredibly successful. Highly recommended!",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  {
    id: "testimonial-2",
    name: "Jessica H.",
    profession: "Web Designer",
    rating: 5,
    description:
      "The attention to detail and user experience in their work is exceptional. I'm thoroughly impressed with the final product.",
    avatarUrl:
      "https://plus.unsplash.com/premium_photo-1690407617542-2f210cf20d7e?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8cHJvZmlsZXxlbnwwfHwwfHx8MA%3D%3D",
  },
  {
    id: "testimonial-3",
    name: "Lisa M.",
    profession: "UX Designer",
    rating: 5,
    description:
      "Working with them was a game-changer for our project. Their expertise and professionalism exceeded our expectations.",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHByb2ZpbGV8ZW58MHx8MHx8fDA%3D",
  },
  {
    id: "testimonial-4",
    name: "Jane D.",
    profession: "UI/UX Designer",
    rating: 5,
    description:
      "The quality of work and communication throughout the project was outstanding. They delivered exactly what we needed.",
    avatarUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDN8fHxlbnwwfHx8fHw%3D",
  },
  {
    id: "testimonial-5",
    name: "Alex R.",
    profession: "Product Manager",
    rating: 5,
    description:
      "A seamless integration that completely transformed our workflow. The attention to premium design is unparalleled.",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop&q=60",
  },
  {
    id: "testimonial-6",
    name: "Sarah W.",
    profession: "Creative Director",
    rating: 5,
    description:
      "The aesthetic is simply breathtaking. Our user engagement has doubled since we adopted this highly polished interface.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=60",
  },
]

const ANIM_IMAGES = [
  "https://img.freepik.com/free-photo/portrait-anime-character-doing-fitness-exercising_23-2151666687.jpg?semt=ais_hybrid&w=740",
  "https://img.freepik.com/free-photo/anime-character-winter_23-2151843507.jpg?semt=ais_hybrid&w=740",
  "https://img.freepik.com/free-photo/anime-character-using-virtual-reality-glasses-metaverse_23-2151568847.jpg?semt=ais_hybrid&w=740",
  "https://img.freepik.com/free-photo/anime-character-using-virtual-reality-glasses-metaverse_23-2151568850.jpg?t=st=1747007259~exp=1747010859~hmac=0f9056951d9ea1c8bf86dd63e33b00ea3a34e3a40575b5ec5b7bd77cfca69ad6&w=996",
  "https://img.freepik.com/free-photo/fantasy-anime-style-scene_23-2151135073.jpg?t=st=1747006767~exp=1747010367~hmac=f744af6af2545a9dcb4f01d78af38e2828b0375243bc3c1dfae391b2db68c09f&w=900",
]

function getSectionClass(theme: string | undefined) {
  return theme === "dark"
    ? "bg-destructive text-secondary px-8 py-12"
    : "bg-accent px-8 py-12"
}

function getReviewStarsClass(theme: string | undefined) {
  return theme === "dark" ? "text-primary" : "text-teal-500"
}

function getTextClass(theme: string | undefined) {
  return theme === "dark" ? "text-primary-foreground" : ""
}

function getAvatarClass(theme: string | undefined) {
  return theme === "dark"
    ? "!size-12 border border-stone-700"
    : "!size-12 border border-stone-300"
}

function getCardVariant(theme: string | undefined) {
  return theme === "dark" ? "dark" : "light"
}

export function TestimonialsVariant() {
  const { theme } = useTheme()

  return (
    <section className="bg-transparent text-white px-4 py-16 relative overflow-hidden" id="testimonials" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="relative z-10">
        <h3 className="text-center text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70 mb-3 tracking-tight">
          What Our Users Say
        </h3>
        <p className="mx-auto max-w-md text-center text-slate-400 text-sm leading-relaxed">
          Hear from thousands of users who have navigated the Indian legal system effortlessly with Vidhan.ai.
        </p>
      </div>
      <ContainerScroll className="container h-[100vh] relative z-10 flex items-center justify-center">
        <div className="sticky left-0 top-0 h-svh w-full flex items-center justify-center -mt-10">
          <CardsContainer className="mx-auto size-full max-h-[450px] w-[350px]">
            {TESTIMONIALS.map((testimonial, index) => (
              <CardTransformed
                arrayLength={TESTIMONIALS.length}
                key={testimonial.id}
                variant="dark"
                index={index}
                role="article"
                aria-labelledby={`card-${testimonial.id}-title`}
                aria-describedby={`card-${testimonial.id}-content`}
              >
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                  <ReviewStars
                    className="text-[#14D9D9] scale-110"
                    rating={testimonial.rating}
                  />
                  <div className="mx-auto w-[90%] text-[16px] font-normal text-[#FFFFFF] leading-[1.6]">
                    <p>
                      "{testimonial.description}"
                    </p>
                  </div>
                  <div className="flex items-center gap-4 pt-4">
                    <Avatar className="!size-12 border border-transparent shadow-sm">
                      <AvatarImage
                        src={testimonial.avatarUrl}
                        alt={`Portrait of ${testimonial.name}`}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-slate-800 text-slate-300 text-xs">
                        {testimonial.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <span className="block text-[16px] font-semibold tracking-tight text-[#FFFFFF] leading-tight">
                        {testimonial.name}
                      </span>
                      <span className="block text-[14px] text-[rgba(255,255,255,0.6)] font-normal mt-1">
                        {testimonial.profession}
                      </span>
                    </div>
                  </div>
                </div>
              </CardTransformed>
            ))}
          </CardsContainer>
        </div>
      </ContainerScroll>
    </section>
  )
}

export const AwardsVariant = () => {
  return (
    <section className="bg-accent px-8 py-12">
      <div>
        <h2 className="text-center text-4xl font-semibold">Recognitions</h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm">
          Industry leading results and accolades.
        </p>
      </div>
      <ContainerScroll className="container h-[300vh] ">
        <div className="sticky left-0 top-0 h-svh w-full py-12">
          <CardsContainer className="mx-auto size-full h-72 w-[440px]">
            <CardTransformed
              className="items-start justify-evenly border-none bg-blue-600/80  text-secondary backdrop-blur-md"
              arrayLength={TESTIMONIALS.length}
              index={1}
            >
              <div className="flex flex-col items-start justify-start space-y-4 ">
                <div className="flex size-16 items-center justify-center  rounded-sm bg-secondary/50 text-2xl">
                  🏆
                </div>
                <div>
                  <h4 className="text-sm uppercase tracking-wide">Awwwards</h4>
                  <h3 className="text-2xl font-bold">Site of the Day</h3>
                </div>
              </div>
              <p className=" text-secondary/80">
                Recognized for excellence in UI/UX design.
              </p>
            </CardTransformed>

            <CardTransformed
              className="items-start justify-evenly border-none bg-orange-600/80 text-secondary backdrop-blur-md"
              arrayLength={TESTIMONIALS.length}
              index={2}
            >
              <div className="flex flex-col items-start justify-start space-y-4 ">
                <div className="flex size-16 items-center justify-center  rounded-sm bg-secondary/50 text-2xl">
                  🚀
                </div>
                <div>
                  <h4 className="text-sm uppercase tracking-wide">
                    Performance
                  </h4>
                  <h3 className="text-2xl font-bold">100% Performance Score</h3>
                </div>
              </div>
              <p className=" text-secondary/80">
                Lightweight and highly responsive.
              </p>
            </CardTransformed>
            <CardTransformed
              className="items-start justify-evenly border-none bg-cyan-600/80 text-secondary backdrop-blur-md"
              arrayLength={TESTIMONIALS.length}
              index={3}
            >
              <div className="flex flex-col items-start justify-start space-y-4 ">
                <div className="flex size-16 items-center justify-center  rounded-sm bg-secondary/50 text-2xl">
                  🎯
                </div>
                <div>
                  <h4 className="text-sm uppercase tracking-wide">
                    CSS awaaards
                  </h4>
                  <h3 className="text-2xl font-bold">Honorable Mention</h3>
                </div>
              </div>
              <p className=" text-secondary/80">
                Commended for interactive elements.
              </p>
            </CardTransformed>
            <CardTransformed
              className="items-start justify-evenly border-none bg-violet-600/80 text-secondary backdrop-blur-md"
              arrayLength={TESTIMONIALS.length}
              index={4}
            >
              <div className="flex flex-col items-start justify-start space-y-4 ">
                <div className="flex size-16 items-center justify-center  rounded-sm bg-secondary/50 text-2xl">
                  🎖
                </div>
                <div>
                  <h4 className="text-sm uppercase tracking-wide">awaaards</h4>
                  <h4 className="text-2xl font-bold">Most Creative Design</h4>
                </div>
              </div>
              <p className=" text-secondary/80">
                For our immersive cinematic approach.
              </p>
            </CardTransformed>
          </CardsContainer>
        </div>
      </ContainerScroll>
    </section>
  )
}

export const ImagesVariant = () => {
  return (
    <section className=" bg-slate-900 px-8 py-12">
      <div>
        <h2 className="text-center text-4xl font-semibold">
          Try our AI Fantázomai
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm">
          Immerse yourself into dynamic visualizations.
        </p>
      </div>
      <ContainerScroll className="container h-[300vh] ">
        <div className="sticky left-0 top-0 h-svh w-full py-12">
          <CardsContainer className="mx-auto size-full h-[420px] w-[320px]">
            {ANIM_IMAGES.map((imageUrl, index) => (
              <CardTransformed
                arrayLength={ANIM_IMAGES.length}
                key={index}
                index={index + 2}
                variant={"dark"}
                className="overflow-hidden !rounded-sm !p-0"
              >
                <img
                  src={imageUrl}
                  alt="anime"
                  className="size-full object-cover"
                  width={"100%"}
                  height={"100%"}
                />
              </CardTransformed>
            ))}
          </CardsContainer>
        </div>
      </ContainerScroll>
    </section>
  )
}
