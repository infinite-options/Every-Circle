import * as React from "react";
import styled from "styled-components";

export function NavigationBar() {
  const navIcons = [
    {
      src: "https://cdn.builder.io/api/v1/image/assets/TEMP/fcdfdcd20451aa9a074d64dac38a8645d48c9da1c7a3a61644b305fcb0e99253?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f",
      alt: "Navigation item 1",
    },
    {
      src: "https://cdn.builder.io/api/v1/image/assets/TEMP/9aeae3e2072e99874ea863a382637f939afb93872427c10db3371703349b34af?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f",
      alt: "Navigation item 2",
    },
    {
      src: "https://cdn.builder.io/api/v1/image/assets/TEMP/0a40456cb6f95854662151d44cc47d317588719e68cd01aae3c6c2a56c0dc7ca?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f",
      alt: "Navigation item 3",
    },
    {
      src: "https://cdn.builder.io/api/v1/image/assets/TEMP/fb6a3b9a00813deab44377471261b54ae7252af071555054fa8da5fcba277f3f?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f",
      alt: "Navigation item 4",
    },
    {
      src: "https://cdn.builder.io/api/v1/image/assets/TEMP/5214bab163673c07f360025401ff14a329cc80e5c8cf456b641cf449f8f415b6?placeholderIfAbsent=true&apiKey=a5d33078a4e9462eaacff740b5ee7f5f",
      alt: "Navigation item 5",
    },
  ];

  return (
    <NavContainer>
      {navIcons.map((icon, index) => (
        <NavIcon
          key={index}
          loading="lazy"
          src={icon.src}
          alt={icon.alt}
          tabIndex={0}
          role="button"
        />
      ))}
    </NavContainer>
  );
}

const NavContainer = styled.nav`
  align-self: center;
  display: flex;
  margin-top: 26px;
  width: 100%;
  max-width: 344px;
  gap: 20px;
  justify-content: space-between;
`;

const NavIcon = styled.img`
  aspect-ratio: 1;
  object-fit: contain;
  object-position: center;
  width: 48px;
  cursor: pointer;

  &:focus {
    outline: 2px solid rgba(175, 82, 222, 1);
    border-radius: 4px;
  }
`;
