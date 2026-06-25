export interface Author {
  name: string;
  role: string;
  image: string;
  linkedIn: string;
  bio: string;
}

export const AUTHORS: Record<string, Author> = {
  "phillip-walsh": {
    name: "Phillip Walsh",
    role: "Founder & Lead Nurturing Strategist",
    image: "https://auroapp.com/phillip-profile.jpg",
    linkedIn: "https://www.linkedin.com/in/phillipdwalsh",
    bio: "Founder of AURO. Former Marketing Director at Sotheby's Realty (UAE & UK), Betterhomes Head of Marketing and Automation, and Unique Properties Head of Marketing. Deep expertise in Dubai real estate lead generation, nurturing, and AI-powered sales automation.",
  },
};

export const DEFAULT_AUTHOR = AUTHORS["phillip-walsh"];
